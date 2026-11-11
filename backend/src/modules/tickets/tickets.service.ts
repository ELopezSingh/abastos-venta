import { randomUUID } from 'node:crypto';
import {
  cajasPedidasPorLinea,
  centavosATexto,
  compararLineas,
  formatearFolio,
  prepararTicket,
  siguienteFolio,
  validarCancelacion,
} from '@abastos/shared';
import type { CrearTicketInput, EstadoTicket, TicketDto, TicketLineaInput } from '@abastos/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { bloquearLineas } from '../../lib/bloqueos.js';
import { prisma, type Db } from '../../lib/prisma.js';
import { aNumero } from '../../lib/dinero.js';
import { hoyCdmx, rangoDelDia } from '../../lib/fechas.js';
import { conReglas } from '../../lib/reglas.js';
import { AppError } from '../../middlewares/error-handler.js';

const conDetalles = {
  detalles: {
    include: {
      manifiestoDetalle: {
        include: {
          trailer: { select: { id: true, numero: true, anden: true } },
        },
      },
    },
  },
} satisfies Prisma.TicketInclude;

type TicketConDetalles = Prisma.TicketGetPayload<{
  include: typeof conDetalles;
}>;

function aDto(t: TicketConDetalles): TicketDto {
  const lineas = t.detalles
    .map((d) => ({
      id: d.id,
      manifiestoDetalleId: d.manifiestoDetalleId,
      trailer: d.manifiestoDetalle.trailer,
      producto: d.manifiestoDetalle.producto,
      color: d.manifiestoDetalle.color,
      tamano: d.manifiestoDetalle.tamano,
      cajas: d.cajas,
      precioCaja: aNumero(d.precioCaja),
      subtotal: aNumero(d.subtotal),
    }))
    .sort(compararLineas);

  return {
    id: t.id,
    folio: t.folio,
    fecha: t.fecha.toISOString(),
    clienteNombre: t.clienteNombre,
    estado: t.estado,
    total: aNumero(t.total),
    totalCajas: lineas.reduce((acc, l) => acc + l.cajas, 0),
    lineas,
  };
}

// ---------- Aplicar (dentro de una transacción; también los usa /api/sync) ----------

export interface VentaPorAplicar {
  id: string;
  /** Si no viene, se asigna el siguiente consecutivo (ventas desde la web). */
  folio?: number;
  /** Hora de la venta (en la tablet, la hora en que se hizo). */
  fecha: Date;
  clienteNombre: string;
  /** El id de cada línea viene cuando lo genera la tablet. */
  lineas: (TicketLineaInput & { id?: string })[];
}

export async function aplicarCrearTicket(tx: Db, venta: VentaPorAplicar): Promise<void> {
  const ids = [...cajasPedidasPorLinea(venta.lineas).keys()].sort();

  // 1. Bloquear las líneas: si dos ventas de la misma línea llegan al mismo
  //    tiempo, la segunda espera a que la primera termine y ve sus cajas.
  await bloquearLineas(tx, ids);

  // 2. Leer las líneas y lo ya vendido (solo tickets vigentes).
  const lineas = await tx.manifiestoDetalle.findMany({
    where: { id: { in: ids } },
    include: { trailer: { select: { numero: true, estado: true } } },
  });
  const vendidas = await tx.ticketDetalle.groupBy({
    by: ['manifiestoDetalleId'],
    where: {
      manifiestoDetalleId: { in: ids },
      ticket: { estado: 'VIGENTE' },
    },
    _sum: { cajas: true },
  });

  // 3. Reglas compartidas: existencia, trailer activo, existencias e importes.
  //    `detalles` sale en el mismo orden que `venta.lineas`.
  const { detalles, total } = conReglas(() =>
    prepararTicket(
      venta.lineas,
      new Map(lineas.map((l) => [l.id, l])),
      new Map(vendidas.map((v) => [v.manifiestoDetalleId, v._sum?.cajas ?? 0])),
    ),
  );

  // 4. Folio. El candado (se libera al terminar la transacción) evita que dos
  //    ventas simultáneas tomen o comprueben el mismo número a la vez.
  await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(4242)`;
  const folio =
    venta.folio ??
    siguienteFolio((await tx.ticket.aggregate({ _max: { folio: true } }))._max.folio);

  const repetido = await tx.ticket.findUnique({
    where: { id: venta.id },
    select: { id: true },
  });
  if (repetido) throw new AppError(409, 'Ese ticket ya está registrado');
  const conFolio = await tx.ticket.findUnique({
    where: { folio },
    select: { id: true },
  });
  if (conFolio) {
    throw new AppError(409, `El folio ${formatearFolio(folio)} ya lo tiene otro ticket`);
  }

  // 5. Guardar ticket y detalles (los centavos se guardan como texto exacto).
  await tx.ticket.create({
    data: {
      id: venta.id,
      folio,
      fecha: venta.fecha,
      clienteNombre: venta.clienteNombre,
      total: centavosATexto(total),
      detalles: {
        create: detalles.map((d, i) => {
          const id = venta.lineas[i]?.id;
          return {
            ...(id ? { id } : {}),
            manifiestoDetalleId: d.manifiestoDetalleId,
            cajas: d.cajas,
            precioCaja: centavosATexto(d.precioCaja),
            subtotal: centavosATexto(d.subtotal),
          };
        }),
      },
    },
  });
}

export async function aplicarCancelarTicket(tx: Db, id: string): Promise<void> {
  // Bloquea el ticket para que dos cancelaciones simultáneas no pasen las dos.
  await tx.$queryRaw`SELECT id FROM tickets WHERE id = ${id}::uuid FOR UPDATE`;
  const ticket = await tx.ticket.findUnique({
    where: { id },
    select: { estado: true, folio: true },
  });
  if (!ticket) throw new AppError(404, 'No existe ese ticket');
  conReglas(() => validarCancelacion(ticket));
  await tx.ticket.update({ where: { id }, data: { estado: 'CANCELADO' } });
}

// ---------- Casos de uso (API REST) ----------

export async function crearTicket(input: CrearTicketInput): Promise<TicketDto> {
  const id = randomUUID();
  await prisma.$transaction((tx) =>
    aplicarCrearTicket(tx, {
      id,
      fecha: new Date(),
      clienteNombre: input.clienteNombre,
      lineas: input.lineas,
    }),
  );
  return obtenerTicket(id);
}

/** Tickets con sus líneas, del folio más alto al más bajo (también lo usa el snapshot). */
export async function buscarTickets(
  db: Db,
  where: Prisma.TicketWhereInput,
): Promise<TicketDto[]> {
  const tickets = await db.ticket.findMany({
    where,
    include: conDetalles,
    orderBy: { folio: "desc" },
  });
  return tickets.map(aDto);
}

export async function listarTickets(
  fecha?: string,
  estado?: EstadoTicket,
): Promise<TicketDto[]> {
  const { desde, hasta } = rangoDelDia(fecha ?? hoyCdmx());
  return buscarTickets(prisma, {
    fecha: { gte: desde, lt: hasta },
    ...(estado && { estado }),
  });
}

export async function obtenerTicket(id: string): Promise<TicketDto> {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: conDetalles,
  });
  if (!ticket) throw new AppError(404, 'No existe ese ticket');
  return aDto(ticket);
}

export async function cancelarTicket(id: string): Promise<TicketDto> {
  await prisma.$transaction((tx) => aplicarCancelarTicket(tx, id));
  return obtenerTicket(id);
}
