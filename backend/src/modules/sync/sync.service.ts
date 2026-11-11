import {
  loteSyncSchema,
  operacionSchema,
  sobreOperacionSchema,
  TIPOS_OPERACION,
  esErrorDeRegla,
} from '@abastos/shared';
import type {
  Operacion,
  RespuestaSyncDto,
  ResultadoOperacionDto,
  SnapshotDto,
} from '@abastos/shared';
import type { ZodError } from 'zod';
import { Prisma } from '../../generated/prisma/client.js';
import { prisma, type Db } from '../../lib/prisma.js';
import { AppError } from '../../middlewares/error-handler.js';
import {
  aplicarCancelarTicket,
  aplicarCrearTicket,
  buscarTickets,
} from '../tickets/tickets.service.js';
import {
  aplicarActualizarLinea,
  aplicarActualizarTrailer,
  aplicarAgregarLinea,
  aplicarCambiarEstado,
  aplicarCrearTrailer,
  aplicarEliminarLinea,
  buscarTrailers,
} from '../trailers/trailers.service.js';

type Sobre = { id: string; tipo: string; creadaEn: string; datos: unknown };

// ---------- Aplicar una operación ----------

async function aplicarOperacion(tx: Db, op: Operacion): Promise<void> {
  // La hora de la tablet: cuenta para el día en que se hizo, no en que llegó.
  const hora = new Date(op.creadaEn);
  switch (op.tipo) {
    case 'trailer.crear':
      return aplicarCrearTrailer(tx, op.datos.id, op.datos, hora);
    case 'trailer.actualizar':
      return aplicarActualizarTrailer(tx, op.datos.trailerId, op.datos.cambios);
    case 'trailer.cambiarEstado':
      return aplicarCambiarEstado(tx, op.datos.trailerId, op.datos.estado, hora);
    case 'linea.agregar':
      return aplicarAgregarLinea(tx, op.datos.trailerId, op.datos.linea);
    case 'linea.actualizar':
      return aplicarActualizarLinea(tx, op.datos.trailerId, op.datos.lineaId, op.datos.cambios);
    case 'linea.eliminar':
      return aplicarEliminarLinea(tx, op.datos.trailerId, op.datos.lineaId);
    case 'ticket.crear':
      return aplicarCrearTicket(tx, {
        id: op.datos.id,
        folio: op.datos.folio,
        fecha: hora,
        clienteNombre: op.datos.clienteNombre,
        lineas: op.datos.lineas,
      });
    case 'ticket.cancelar':
      return aplicarCancelarTicket(tx, op.datos.ticketId);
    default: {
      // Si se agrega un tipo nuevo y falta aquí, TypeScript marca error.
      const sinManejar: never = op;
      throw new Error(`Operación sin manejar: ${JSON.stringify(sinManejar)}`);
    }
  }
}

// ---------- Rechazos ----------

function describirZod(error: ZodError): string {
  const problema = error.issues[0];
  if (!problema) return 'datos inválidos';
  const ruta = problema.path.join('.');
  return ruta ? `${ruta}: ${problema.message}` : problema.message;
}

/**
 * Motivo de rechazo para errores que son culpa de la operación (reglas de
 * negocio o datos que no cuadran). Devuelve null en errores inesperados
 * (conexión, fallas del código): esos no se rechazan, se reintentan.
 */
function motivoDeError(e: unknown): string | null {
  if (e instanceof AppError || esErrorDeRegla(e)) return e.message;
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case 'P2002':
        return 'Ya existe un registro con ese id o folio';
      case 'P2003':
        return 'Hace referencia a un registro que no existe';
      case 'P2025':
        return 'El registro que se quiere cambiar ya no existe';
    }
  }
  return null;
}

async function rechazar(sobre: Sobre, motivo: string): Promise<ResultadoOperacionDto> {
  const datos = (sobre.datos ?? {}) as Prisma.InputJsonValue;
  await prisma.operacionRechazada.upsert({
    where: { id: sobre.id },
    create: {
      id: sobre.id,
      tipo: sobre.tipo,
      datos,
      creadaEn: new Date(sobre.creadaEn),
      motivo,
    },
    update: {
      tipo: sobre.tipo,
      datos,
      motivo,
      intentos: { increment: 1 },
      ultimaVez: new Date(),
    },
  });
  return { id: sobre.id, estado: 'RECHAZADA', motivo };
}

function idDe(cruda: unknown): string | null {
  const id = (cruda as { id?: unknown } | null)?.id;
  return typeof id === 'string' ? id : null;
}

// ---------- Procesar ----------

async function procesarOperacion(cruda: unknown): Promise<ResultadoOperacionDto> {
  const sobre = sobreOperacionSchema.safeParse(cruda);
  if (!sobre.success) {
    // Sin id y hora válidos no se puede guardar el rechazo; solo se responde.
    return {
      id: idDe(cruda),
      estado: 'RECHAZADA',
      motivo: `Operación mal formada (${describirZod(sobre.error)})`,
    };
  }
  const { id, tipo, creadaEn, datos } = sobre.data;

  if (!(TIPOS_OPERACION as readonly string[]).includes(tipo)) {
    return rechazar(sobre.data, `Tipo de operación desconocido: ${tipo}`);
  }
  const op = operacionSchema.safeParse(cruda);
  if (!op.success) {
    return rechazar(sobre.data, `Datos inválidos (${describirZod(op.error)})`);
  }

  try {
    const estado = await prisma.$transaction(
      async (tx) => {
        // Una operación a la vez: si la tablet reenvía un lote mientras el
        // primero sigue en proceso, el segundo espera y la ve como ya aplicada.
        await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(4243)`;

        const yaAplicada = await tx.operacionSync.findUnique({
          where: { id },
          select: { id: true },
        });
        if (yaAplicada) return 'YA_APLICADA' as const;

        await aplicarOperacion(tx, op.data);
        await tx.operacionSync.create({
          data: {
            id,
            tipo,
            datos: datos as Prisma.InputJsonValue,
            creadaEn: new Date(creadaEn),
          },
        });
        // Si antes se había rechazado y ahora pasó, ya no está pendiente.
        await tx.operacionRechazada.deleteMany({ where: { id } });
        return 'APLICADA' as const;
      },
      { timeout: 15_000 },
    );
    return { id, estado, motivo: null };
  } catch (e) {
    const motivo = motivoDeError(e);
    if (motivo === null) throw e; // inesperado: falla la petición y la tablet reintenta
    return rechazar(sobre.data, motivo);
  }
}

async function registrarContacto(): Promise<void> {
  const ahora = new Date();
  await prisma.estadoSync.upsert({
    where: { id: 1 },
    create: { id: 1, ultimoContacto: ahora },
    update: { ultimoContacto: ahora },
  });
}

// ---------- Casos de uso ----------

/** Aplica en orden un lote de operaciones de la tablet. */
export async function sincronizar(cuerpo: unknown): Promise<RespuestaSyncDto> {
  const { operaciones } = loteSyncSchema.parse(cuerpo);

  const resultados: ResultadoOperacionDto[] = [];
  for (const cruda of operaciones) {
    resultados.push(await procesarOperacion(cruda));
  }
  // Al final: si el lote falla a medias, el contacto no se marca como completo.
  await registrarContacto();

  return { resultados, horaServidor: new Date().toISOString() };
}

/** Carga inicial de la tablet: trailers activos, sus tickets y el último folio. */
export async function snapshot(): Promise<SnapshotDto> {
  // REPEATABLE READ: las tres lecturas ven la base en el mismo instante.
  return prisma.$transaction(
    async (tx) => {
      const trailers = await buscarTrailers(tx, { estado: 'ACTIVO' });
      const tickets = await buscarTickets(tx, {
        detalles: {
          some: { manifiestoDetalle: { trailer: { estado: 'ACTIVO' } } },
        },
      });
      const { _max } = await tx.ticket.aggregate({ _max: { folio: true } });
      return {
        generadoEn: new Date().toISOString(),
        ultimoFolio: _max.folio ?? 0,
        trailers,
        tickets,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 30_000,
    },
  );
}
