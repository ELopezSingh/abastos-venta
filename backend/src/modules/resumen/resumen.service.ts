import { calcularLiquidacion, calcularResumenDia } from "@abastos/shared";
import type { LiquidacionTrailerDto, ResumenDiaDto } from "@abastos/shared";
import { prisma } from "../../lib/prisma.js";
import { aNumero, centavosDe } from "../../lib/dinero.js";
import { hoyCdmx, rangoDelDia } from "../../lib/fechas.js";
import { AppError } from "../../middlewares/error-handler.js";

// ---------- Resumen del día ----------

export async function resumenDelDia(fecha = hoyCdmx()): Promise<ResumenDiaDto> {
  const { desde, hasta } = rangoDelDia(fecha);

  const [tickets, anden] = await Promise.all([
    prisma.ticket.findMany({
      where: { fecha: { gte: desde, lt: hasta }, estado: "VIGENTE" },
      select: {
        total: true,
        detalles: {
          select: {
            cajas: true,
            subtotal: true,
            manifiestoDetalle: {
              select: {
                trailer: {
                  select: {
                    id: true,
                    viaje: true,
                    numero: true,
                    invernadero: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    // Gastos de andén: trailers que llegaron ese día.
    prisma.trailer.aggregate({
      where: { fechaLlegada: { gte: desde, lt: hasta } },
      _sum: { costoAnden: true },
    }),
  ]);

  return calcularResumenDia(
    fecha,
    tickets.map((t) => ({
      total: centavosDe(t.total),
      detalles: t.detalles.map((d) => ({
        cajas: d.cajas,
        subtotal: centavosDe(d.subtotal),
        trailer: d.manifiestoDetalle.trailer,
      })),
    })),
    anden._sum.costoAnden ? centavosDe(anden._sum.costoAnden) : 0,
  );
}

// ---------- Liquidación de un trailer ----------

export async function liquidacionTrailer(
  id: string,
): Promise<LiquidacionTrailerDto> {
  const trailer = await prisma.trailer.findUnique({
    where: { id },
    include: {
      manifiesto: {
        include: {
          ventas: {
            where: { ticket: { estado: "VIGENTE" } },
            include: {
              ticket: {
                select: {
                  id: true,
                  folio: true,
                  fecha: true,
                  clienteNombre: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!trailer) throw new AppError(404, "No existe ese trailer");

  const calculo = calcularLiquidacion(
    trailer.manifiesto.map((l) => ({
      producto: l.producto,
      color: l.color,
      tamano: l.tamano,
      cajas: l.cajas,
      ventas: l.ventas.map((v) => ({
        ticketId: v.ticket.id,
        folio: v.ticket.folio,
        fecha: v.ticket.fecha.toISOString(),
        clienteNombre: v.ticket.clienteNombre,
        cajas: v.cajas,
        precioCaja: centavosDe(v.precioCaja),
        subtotal: centavosDe(v.subtotal),
      })),
    })),
    {
      flete: centavosDe(trailer.flete),
      piso: centavosDe(trailer.costoAnden),
      descarga: centavosDe(trailer.descarga),
      comisionPorcentaje: aNumero(trailer.comisionPorcentaje),
    },
  );

  return {
    trailer: {
      id: trailer.id,
      viaje: trailer.viaje,
      numero: trailer.numero,
      placa: trailer.placa,
      invernadero: trailer.invernadero,
      chofer: trailer.chofer,
      anden: trailer.anden,
      fechaLlegada: trailer.fechaLlegada.toISOString(),
      fechaCierre: trailer.fechaCierre?.toISOString() ?? null,
      estado: trailer.estado,
    },
    ...calculo,
  };
}
