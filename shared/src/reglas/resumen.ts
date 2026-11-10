import { aPesos, sumarCentavos, type Centavos } from "../dinero.js";
import type { ResumenDiaDto, ResumenDiaTrailerDto } from "../resumen.js";

export interface TicketParaResumen {
  total: Centavos;
  detalles: readonly {
    cajas: number;
    subtotal: Centavos;
    trailer: {
      id: string;
      viaje: string | null;
      numero: string;
      invernadero: string;
    };
  }[];
}

/**
 * `tickets`: solo los VIGENTE del día.
 * `gastosAnden`: costo de andén de los trailers que llegaron ese día.
 */
export function calcularResumenDia(
  fecha: string,
  tickets: readonly TicketParaResumen[],
  gastosAnden: Centavos,
): ResumenDiaDto {
  let cajasVendidas = 0;
  const porTrailer = new Map<
    string,
    { dto: Omit<ResumenDiaTrailerDto, "venta">; venta: Centavos }
  >();

  for (const ticket of tickets) {
    for (const d of ticket.detalles) {
      cajasVendidas += d.cajas;
      const t = d.trailer;
      const acumulado = porTrailer.get(t.id) ?? {
        dto: {
          trailerId: t.id,
          viaje: t.viaje,
          numero: t.numero,
          invernadero: t.invernadero,
          cajasVendidas: 0,
        },
        venta: 0,
      };
      acumulado.dto.cajasVendidas += d.cajas;
      acumulado.venta += d.subtotal;
      porTrailer.set(t.id, acumulado);
    }
  }

  const ventas = sumarCentavos(tickets.map((t) => t.total));

  return {
    fecha,
    tickets: tickets.length,
    cajasVendidas,
    ventas: aPesos(ventas),
    gastosAnden: aPesos(gastosAnden),
    ganancia: aPesos(ventas - gastosAnden),
    porTrailer: [...porTrailer.values()]
      .sort((a, b) => b.venta - a.venta)
      .map(({ dto, venta }) => ({ ...dto, venta: aPesos(venta) })),
  };
}
