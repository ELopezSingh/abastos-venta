import { randomUUID } from 'node:crypto';
import {
  compararLineas,
  disponiblesDeLinea,
  fechaCierrePara,
  normalizarColor,
  validarCajasDeLinea,
  validarColorDeCambio,
  validarEliminarLinea,
  VALORES_POR_DEFECTO_TRAILER,
} from '@abastos/shared';
import type {
  ActualizarManifiestoLineaInput,
  ActualizarTrailerInput,
  CrearTrailerInput,
  EstadoTrailer,
  ManifiestoLineaInput,
  TrailerDto,
  PaginaTrailersCerradosDto,
} from '@abastos/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { bloquearLineas } from '../../lib/bloqueos.js';
import { prisma, type Db } from '../../lib/prisma.js';
import { aDecimal, aNumero } from '../../lib/dinero.js';
import { conReglas } from '../../lib/reglas.js';
import { AppError } from '../../middlewares/error-handler.js';

// Sin orderBy: con UUID el id no refleja el orden de captura.
// Las líneas se ordenan en aDto con compararLineas.
const conManifiesto = {
  manifiesto: true,
} satisfies Prisma.TrailerInclude;

type TrailerConManifiesto = Prisma.TrailerGetPayload<{
  include: typeof conManifiesto;
}>;

/** Línea del manifiesto; el id viene cuando lo genera la tablet. */
type LineaConId = ManifiestoLineaInput & { id?: string };

/** Alta de trailer: las líneas traen id (tablet) o no (web). */
export type CrearTrailerConIds = Omit<CrearTrailerInput, 'manifiesto'> & {
  manifiesto: LineaConId[];
};

/** Cajas vendidas por línea de manifiesto (solo tickets vigentes). */
async function vendidasPorLinea(db: Db, lineaIds: string[]): Promise<Map<string, number>> {
  if (lineaIds.length === 0) return new Map();
  const filas = await db.ticketDetalle.groupBy({
    by: ['manifiestoDetalleId'],
    where: {
      manifiestoDetalleId: { in: lineaIds },
      ticket: { estado: 'VIGENTE' },
    },
    _sum: { cajas: true },
  });
  return new Map(filas.map((f) => [f.manifiestoDetalleId, f._sum?.cajas ?? 0]));
}

function aDto(t: TrailerConManifiesto, vendidas: Map<string, number>): TrailerDto {
  const manifiesto = [...t.manifiesto].sort(compararLineas).map((l) => {
    const v = vendidas.get(l.id) ?? 0;
    return {
      id: l.id,
      producto: l.producto,
      color: l.color,
      tamano: l.tamano,
      cajas: l.cajas,
      vendidas: v,
      disponibles: disponiblesDeLinea(l.cajas, v),
    };
  });
  const suma = (campo: 'cajas' | 'vendidas' | 'disponibles') =>
    manifiesto.reduce((acc, l) => acc + l[campo], 0);

  return {
    id: t.id,
    viaje: t.viaje,
    placa: t.placa,
    numero: t.numero,
    invernadero: t.invernadero,
    chofer: t.chofer,
    anden: t.anden,
    costoAnden: aNumero(t.costoAnden),
    flete: aNumero(t.flete),
    descarga: aNumero(t.descarga),
    comisionPorcentaje: aNumero(t.comisionPorcentaje),
    fechaLlegada: t.fechaLlegada.toISOString(),
    fechaCierre: t.fechaCierre?.toISOString() ?? null,
    estado: t.estado,
    manifiesto,
    totales: {
      cajas: suma('cajas'),
      vendidas: suma('vendidas'),
      disponibles: suma('disponibles'),
    },
  };
}

async function aDtos(trailers: TrailerConManifiesto[], db: Db = prisma): Promise<TrailerDto[]> {
  const ids = trailers.flatMap((t) => t.manifiesto.map((l) => l.id));
  const vendidas = await vendidasPorLinea(db, ids);
  return trailers.map((t) => aDto(t, vendidas));
}

const lineaAData = (l: LineaConId) => ({
  ...(l.id ? { id: l.id } : {}),
  producto: l.producto,
  color: normalizarColor(l.color),
  tamano: l.tamano,
  cajas: l.cajas,
});

async function revisarQueExista(db: Db, id: string): Promise<void> {
  const trailer = await db.trailer.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!trailer) throw new AppError(404, 'No existe ese trailer');
}

async function lineaDelTrailer(db: Db, trailerId: string, lineaId: string) {
  const linea = await db.manifiestoDetalle.findFirst({
    where: { id: lineaId, trailerId },
  });
  if (!linea) {
    throw new AppError(404, 'Esa línea del manifiesto no pertenece a este trailer');
  }
  return linea;
}

// ---------- Aplicar (dentro de una transacción; también los usa /api/sync) ----------

export async function aplicarCrearTrailer(
  tx: Db,
  id: string,
  input: CrearTrailerConIds,
  fechaLlegada: Date,
): Promise<void> {
  const repetido = await tx.trailer.findUnique({
    where: { id },
    select: { id: true },
  });
  if (repetido) throw new AppError(409, 'Ese trailer ya está registrado');

  const { manifiesto, costoAnden, flete, descarga, comisionPorcentaje, ...datos } = input;
  const porDefecto = VALORES_POR_DEFECTO_TRAILER;
  // El create anidado guarda trailer y manifiesto juntos.
  await tx.trailer.create({
    data: {
      ...datos,
      id,
      fechaLlegada,
      costoAnden: aDecimal(costoAnden),
      flete: aDecimal(flete ?? porDefecto.flete),
      descarga: aDecimal(descarga ?? porDefecto.descarga),
      comisionPorcentaje: aDecimal(comisionPorcentaje ?? porDefecto.comisionPorcentaje),
      manifiesto: { create: manifiesto.map(lineaAData) },
    },
  });
}

export async function aplicarActualizarTrailer(
  tx: Db,
  id: string,
  input: ActualizarTrailerInput,
): Promise<void> {
  await revisarQueExista(tx, id);
  const { costoAnden, flete, descarga, comisionPorcentaje, ...datos } = input;
  await tx.trailer.update({
    where: { id },
    data: {
      ...datos,
      // Solo se actualizan los importes que vienen en la petición.
      ...(costoAnden !== undefined && { costoAnden: aDecimal(costoAnden) }),
      ...(flete !== undefined && { flete: aDecimal(flete) }),
      ...(descarga !== undefined && { descarga: aDecimal(descarga) }),
      ...(comisionPorcentaje !== undefined && {
        comisionPorcentaje: aDecimal(comisionPorcentaje),
      }),
    },
  });
}

export async function aplicarCambiarEstado(
  tx: Db,
  id: string,
  estado: EstadoTrailer,
  ahora: Date,
): Promise<void> {
  await revisarQueExista(tx, id);
  await tx.trailer.update({
    where: { id },
    data: { estado, fechaCierre: fechaCierrePara(estado, ahora) },
  });
}

export async function aplicarAgregarLinea(
  tx: Db,
  trailerId: string,
  linea: LineaConId,
): Promise<void> {
  await revisarQueExista(tx, trailerId);
  if (linea.id) {
    const repetida = await tx.manifiestoDetalle.findUnique({
      where: { id: linea.id },
      select: { id: true },
    });
    if (repetida) {
      throw new AppError(409, 'Esa línea del manifiesto ya está registrada');
    }
  }
  await tx.manifiestoDetalle.create({
    data: { trailerId, ...lineaAData(linea) },
  });
}

export async function aplicarActualizarLinea(
  tx: Db,
  trailerId: string,
  lineaId: string,
  input: ActualizarManifiestoLineaInput,
): Promise<void> {
  // Bloquea la línea para que una venta no se cuele entre la revisión y el cambio.
  await bloquearLineas(tx, [lineaId]);
  const actual = await lineaDelTrailer(tx, trailerId, lineaId);
  conReglas(() => validarColorDeCambio(actual, input));

  if (input.cajas !== undefined) {
    const cajas = input.cajas;
    const vendidas = (await vendidasPorLinea(tx, [lineaId])).get(lineaId) ?? 0;
    conReglas(() => validarCajasDeLinea(cajas, vendidas));
  }
  await tx.manifiestoDetalle.update({
    where: { id: lineaId },
    data: {
      ...input,
      ...(input.color !== undefined && { color: normalizarColor(input.color) }),
    },
  });
}

export async function aplicarEliminarLinea(
  tx: Db,
  trailerId: string,
  lineaId: string,
): Promise<void> {
  await bloquearLineas(tx, [lineaId]);
  await lineaDelTrailer(tx, trailerId, lineaId);
  const ventas = await tx.ticketDetalle.count({
    where: { manifiestoDetalleId: lineaId },
  });
  conReglas(() => validarEliminarLinea(ventas));
  await tx.manifiestoDetalle.delete({ where: { id: lineaId } });
}

// ---------- Casos de uso (API REST) ----------

export async function crearTrailer(input: CrearTrailerInput): Promise<TrailerDto> {
  const id = randomUUID();
  await prisma.$transaction((tx) => aplicarCrearTrailer(tx, id, input, new Date()));
  return obtenerTrailer(id);
}

/** Trailers con su manifiesto y existencias (también lo usa el snapshot). */
export async function buscarTrailers(
  db: Db,
  where: Prisma.TrailerWhereInput = {},
): Promise<TrailerDto[]> {
  const trailers = await db.trailer.findMany({
    where,
    include: conManifiesto,
    orderBy: { fechaLlegada: "desc" },
  });
  return aDtos(trailers, db);
}

export async function listarTrailers(
  estado?: EstadoTrailer,
): Promise<TrailerDto[]> {
  return buscarTrailers(prisma, estado ? { estado } : {});
}

export async function obtenerTrailer(id: string): Promise<TrailerDto> {
  const trailer = await prisma.trailer.findUnique({
    where: { id },
    include: conManifiesto,
  });
  if (!trailer) throw new AppError(404, 'No existe ese trailer');
  const [dto] = await aDtos([trailer]);
  return dto!;
}

export async function actualizarTrailer(
  id: string,
  input: ActualizarTrailerInput,
): Promise<TrailerDto> {
  await prisma.$transaction((tx) => aplicarActualizarTrailer(tx, id, input));
  return obtenerTrailer(id);
}

export async function cambiarEstado(id: string, estado: EstadoTrailer): Promise<TrailerDto> {
  await prisma.$transaction((tx) => aplicarCambiarEstado(tx, id, estado, new Date()));
  return obtenerTrailer(id);
}

const POR_PAGINA = 20;

export async function listarCerrados(
  q: string | undefined,
  desde: number,
): Promise<PaginaTrailersCerradosDto> {
  const busqueda = q
    ? {
        OR: (['viaje', 'numero', 'invernadero', 'placa'] as const).map((campo) => ({
          [campo]: { contains: q, mode: 'insensitive' as const },
        })),
      }
    : {};

  // Se pide uno de más para saber si hay otra página.
  // El id al final solo desempata, para que la paginación sea estable.
  const filas = await prisma.trailer.findMany({
    where: { estado: 'CERRADO', ...busqueda },
    orderBy: [
      { fechaCierre: { sort: 'desc', nulls: 'last' } },
      { fechaLlegada: 'desc' },
      { id: 'desc' },
    ],
    skip: desde,
    take: POR_PAGINA + 1,
    include: { manifiesto: { select: { id: true, cajas: true } } },
  });
  const pagina = filas.slice(0, POR_PAGINA);
  const vendidas = await vendidasPorLinea(
    prisma,
    pagina.flatMap((t) => t.manifiesto.map((l) => l.id)),
  );

  return {
    trailers: pagina.map((t) => ({
      id: t.id,
      viaje: t.viaje,
      numero: t.numero,
      invernadero: t.invernadero,
      placa: t.placa,
      fechaLlegada: t.fechaLlegada.toISOString(),
      fechaCierre: t.fechaCierre?.toISOString() ?? null,
      cajas: t.manifiesto.reduce((acc, l) => acc + l.cajas, 0),
      vendidas: t.manifiesto.reduce((acc, l) => acc + (vendidas.get(l.id) ?? 0), 0),
    })),
    siguiente: filas.length > POR_PAGINA ? desde + POR_PAGINA : null,
  };
}

// ---------- Correcciones al manifiesto ----------

export async function agregarLinea(
  trailerId: string,
  input: ManifiestoLineaInput,
): Promise<TrailerDto> {
  await prisma.$transaction((tx) => aplicarAgregarLinea(tx, trailerId, input));
  return obtenerTrailer(trailerId);
}

export async function actualizarLinea(
  trailerId: string,
  lineaId: string,
  input: ActualizarManifiestoLineaInput,
): Promise<TrailerDto> {
  await prisma.$transaction((tx) => aplicarActualizarLinea(tx, trailerId, lineaId, input));
  return obtenerTrailer(trailerId);
}

export async function eliminarLinea(trailerId: string, lineaId: string): Promise<TrailerDto> {
  await prisma.$transaction((tx) => aplicarEliminarLinea(tx, trailerId, lineaId));
  return obtenerTrailer(trailerId);
}
