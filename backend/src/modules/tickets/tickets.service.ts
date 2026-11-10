import {
  cajasPedidasPorLinea,
  centavosATexto,
  compararLineas,
  prepararTicket,
  siguienteFolio,
  validarCancelacion,
} from "@abastos/shared";
import type {
  CrearTicketInput,
  EstadoTicket,
  TicketDto,
} from "@abastos/shared";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { aNumero } from "../../lib/dinero.js";
import { hoyCdmx, rangoDelDia } from "../../lib/fechas.js";
import { conReglas } from "../../lib/reglas.js";
import { AppError } from "../../middlewares/error-handler.js";

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

// ---------- Casos de uso ----------

export async function crearTicket(input: CrearTicketInput): Promise<TicketDto> {
  const ids = [...cajasPedidasPorLinea(input.lineas).keys()].sort();

  const ticketId = await prisma.$transaction(async (tx) => {
    // 1. Bloquear las líneas del manifiesto hasta que termine la transacción.
    //    Si dos ventas de la misma línea llegan al mismo tiempo, la segunda
    //    espera a que la primera termine y ya ve sus cajas vendidas.
    //    Prisma manda el arreglo como text[]; el cast lo vuelve uuid[].
    await tx.$queryRaw`
      SELECT id FROM manifiesto_detalle
      WHERE id = ANY(${ids}::uuid[])
      ORDER BY id
      FOR UPDATE`;

    // 2. Leer las líneas y lo ya vendido (solo tickets vigentes).
    const lineas = await tx.manifiestoDetalle.findMany({
      where: { id: { in: ids } },
      include: { trailer: { select: { numero: true, estado: true } } },
    });
    const vendidas = await tx.ticketDetalle.groupBy({
      by: ["manifiestoDetalleId"],
      where: {
        manifiestoDetalleId: { in: ids },
        ticket: { estado: "VIGENTE" },
      },
      _sum: { cajas: true },
    });

    // 3. Reglas compartidas: existencia, trailer activo, existencias e importes.
    const { detalles, total } = conReglas(() =>
      prepararTicket(
        input.lineas,
        new Map(lineas.map((l) => [l.id, l])),
        new Map(vendidas.map((v) => [v.manifiestoDetalleId, v._sum?.cajas ?? 0])),
      ),
    );

    // 4. Folio consecutivo. El candado (se libera al terminar la transacción)
    //    evita que dos ventas simultáneas tomen el mismo número.
    await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(4242)`;
    const { _max } = await tx.ticket.aggregate({ _max: { folio: true } });

    // 5. Guardar ticket y detalles (los centavos se guardan como texto exacto).
    const ticket = await tx.ticket.create({
      data: {
        folio: siguienteFolio(_max.folio),
        clienteNombre: input.clienteNombre,
        total: centavosATexto(total),
        detalles: {
          create: detalles.map((d) => ({
            manifiestoDetalleId: d.manifiestoDetalleId,
            cajas: d.cajas,
            precioCaja: centavosATexto(d.precioCaja),
            subtotal: centavosATexto(d.subtotal),
          })),
        },
      },
      select: { id: true },
    });
    return ticket.id;
  });

  return obtenerTicket(ticketId);
}

export async function listarTickets(
  fecha?: string,
  estado?: EstadoTicket,
): Promise<TicketDto[]> {
  const { desde, hasta } = rangoDelDia(fecha ?? hoyCdmx());
  const tickets = await prisma.ticket.findMany({
    where: { fecha: { gte: desde, lt: hasta }, ...(estado && { estado }) },
    include: conDetalles,
    orderBy: { folio: "desc" },
  });
  return tickets.map(aDto);
}

export async function obtenerTicket(id: string): Promise<TicketDto> {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: conDetalles,
  });
  if (!ticket) throw new AppError(404, "No existe ese ticket");
  return aDto(ticket);
}

export async function cancelarTicket(id: string): Promise<TicketDto> {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { estado: true, folio: true },
  });
  if (!ticket) throw new AppError(404, "No existe ese ticket");
  conReglas(() => validarCancelacion(ticket));

  await prisma.ticket.update({ where: { id }, data: { estado: "CANCELADO" } });
  return obtenerTicket(id);
}
