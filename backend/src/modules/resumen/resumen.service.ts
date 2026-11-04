import { compararLineas, ordenTamano } from "@abastos/shared";
import type {
  LiquidacionProductoDto,
  LiquidacionTrailerDto,
  ResumenDiaDto,
  ResumenDiaTrailerDto,
} from "@abastos/shared";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { aNumero } from "../../lib/dinero.js";
import { hoyCdmx, rangoDelDia } from "../../lib/fechas.js";
import { AppError } from "../../middlewares/error-handler.js";

const cero = () => new Prisma.Decimal(0);

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

  let ventas = cero();
  let cajasVendidas = 0;
  const porTrailer = new Map<
    string,
    { dto: Omit<ResumenDiaTrailerDto, "venta">; venta: Prisma.Decimal }
  >();

  for (const ticket of tickets) {
    ventas = ventas.add(ticket.total);
    for (const d of ticket.detalles) {
      cajasVendidas += d.cajas;
      const t = d.manifiestoDetalle.trailer;
      const acumulado = porTrailer.get(t.id) ?? {
        dto: {
          trailerId: t.id,
          viaje: t.viaje,
          numero: t.numero,
          invernadero: t.invernadero,
          cajasVendidas: 0,
        },
        venta: cero(),
      };
      acumulado.dto.cajasVendidas += d.cajas;
      acumulado.venta = acumulado.venta.add(d.subtotal);
      porTrailer.set(t.id, acumulado);
    }
  }

  const gastosAnden = anden._sum.costoAnden ?? cero();

  return {
    fecha,
    tickets: tickets.length,
    cajasVendidas,
    ventas: aNumero(ventas),
    gastosAnden: aNumero(gastosAnden),
    ganancia: aNumero(ventas.sub(gastosAnden)),
    porTrailer: [...porTrailer.values()]
      .map(({ dto, venta }) => ({ ...dto, venta: aNumero(venta) }))
      .sort((a, b) => b.venta - a.venta),
  };
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

  // Agrupar las líneas del manifiesto por producto + color (como cada bloque de la hoja).
  // Se ordenan antes para que los bloques salgan siempre en el mismo orden.
  const grupos = new Map<string, typeof trailer.manifiesto>();
  for (const linea of [...trailer.manifiesto].sort(compararLineas)) {
    const nombre = [linea.producto, linea.color].filter(Boolean).join(" ");
    grupos.set(nombre, [...(grupos.get(nombre) ?? []), linea]);
  }

  let ventaTrailer = cero();
  const productos: LiquidacionProductoDto[] = [];

  for (const [producto, lineas] of grupos) {
    let ventaProducto = cero();
    const tamanos = lineas
      .map((l) => {
        const vendidas = l.ventas.reduce((acc, v) => acc + v.cajas, 0);
        return {
          tamano: l.tamano,
          recibidas: l.cajas,
          vendidas,
          quedan: l.cajas - vendidas,
        };
      })
      .sort((a, b) => ordenTamano(a.tamano) - ordenTamano(b.tamano));

    const ventas = lineas
      .flatMap((l) =>
        l.ventas.map((v) => {
          ventaProducto = ventaProducto.add(v.subtotal);
          return {
            ticketId: v.ticket.id,
            folio: v.ticket.folio,
            fecha: v.ticket.fecha.toISOString(),
            clienteNombre: v.ticket.clienteNombre,
            tamano: l.tamano,
            cajas: v.cajas,
            precioCaja: aNumero(v.precioCaja),
            subtotal: aNumero(v.subtotal),
          };
        }),
      )
      .sort((a, b) => a.folio - b.folio);

    ventaTrailer = ventaTrailer.add(ventaProducto);
    productos.push({
      producto,
      tamanos,
      totales: {
        recibidas: tamanos.reduce((acc, t) => acc + t.recibidas, 0),
        vendidas: tamanos.reduce((acc, t) => acc + t.vendidas, 0),
        quedan: tamanos.reduce((acc, t) => acc + t.quedan, 0),
      },
      venta: aNumero(ventaProducto),
      ventas,
    });
  }

  // Gastos: flete + piso + descarga + comisión (porcentaje sobre la venta).
  const comision = ventaTrailer
    .mul(trailer.comisionPorcentaje)
    .div(100)
    .toDecimalPlaces(2);
  const totalGastos = trailer.flete
    .add(trailer.costoAnden)
    .add(trailer.descarga)
    .add(comision);

  const suma = (campo: "recibidas" | "vendidas" | "quedan") =>
    productos.reduce((acc, p) => acc + p.totales[campo], 0);

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
    productos,
    cajas: {
      entrada: suma("recibidas"),
      vendidas: suma("vendidas"),
      quedan: suma("quedan"),
    },
    venta: aNumero(ventaTrailer),
    gastos: {
      flete: aNumero(trailer.flete),
      piso: aNumero(trailer.costoAnden),
      descarga: aNumero(trailer.descarga),
      comisionPorcentaje: aNumero(trailer.comisionPorcentaje),
      comision: aNumero(comision),
      total: aNumero(totalGastos),
    },
    balance: aNumero(ventaTrailer.sub(totalGastos)),
  };
}
