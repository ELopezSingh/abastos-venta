import { formatearFolio } from "../catalogos.js";
import {
  aCentavos,
  multiplicarCentavos,
  sumarCentavos,
  type Centavos,
} from "../dinero.js";
import { ErrorDeRegla } from "../errores.js";
import type { EstadoTicket, TicketLineaInput } from "../ticket.js";
import type { EstadoTrailer } from "../trailer.js";

/** "Morrón Rojo XL" (el tamaño es opcional). */
export function nombreDeLinea(
  producto: string,
  color: string | null,
  tamano?: string,
): string {
  return [producto, color, tamano].filter(Boolean).join(" ");
}

/** Cajas pedidas por línea de manifiesto (por si la misma línea viene dos veces). */
export function cajasPedidasPorLinea(
  lineas: readonly Pick<TicketLineaInput, "manifiestoDetalleId" | "cajas">[],
): Map<string, number> {
  const pedidas = new Map<string, number>();
  for (const l of lineas) {
    pedidas.set(
      l.manifiestoDetalleId,
      (pedidas.get(l.manifiestoDetalleId) ?? 0) + l.cajas,
    );
  }
  return pedidas;
}

export interface LineaManifiestoParaVenta {
  producto: string;
  color: string | null;
  tamano: string;
  cajas: number;
  trailer: { numero: string; estado: EstadoTrailer };
}

export interface DetallePreparado {
  manifiestoDetalleId: string;
  cajas: number;
  precioCaja: Centavos;
  subtotal: Centavos;
}

export interface TicketPreparado {
  detalles: DetallePreparado[];
  total: Centavos;
}

/**
 * Valida una venta y calcula subtotales y total.
 * - `manifiesto`: líneas del manifiesto por id (las que existan).
 * - `vendidas`: cajas ya vendidas por línea (solo tickets VIGENTE).
 */
export function prepararTicket(
  lineas: readonly TicketLineaInput[],
  manifiesto: ReadonlyMap<string, LineaManifiestoParaVenta>,
  vendidas: ReadonlyMap<string, number>,
): TicketPreparado {
  const pedidas = cajasPedidasPorLinea(lineas);
  const ids = [...pedidas.keys()].sort();

  // 1. Que existan y que su trailer siga activo.
  for (const id of ids) {
    const linea = manifiesto.get(id);
    if (!linea) {
      throw new ErrorDeRegla(
        "NO_ENCONTRADO",
        "Uno de los productos del ticket ya no existe en el manifiesto",
      );
    }
    if (linea.trailer.estado !== "ACTIVO") {
      throw new ErrorDeRegla(
        "CONFLICTO",
        `El trailer ${linea.trailer.numero} está cerrado; no se puede vender de él`,
      );
    }
  }

  // 2. Existencias.
  for (const id of ids) {
    const linea = manifiesto.get(id)!;
    const disponibles = linea.cajas - (vendidas.get(id) ?? 0);
    const solicitadas = pedidas.get(id)!;
    if (solicitadas > disponibles) {
      throw new ErrorDeRegla(
        "CONFLICTO",
        `Solo quedan ${disponibles} cajas de ${nombreDeLinea(linea.producto, linea.color, linea.tamano)} (trailer ${linea.trailer.numero}); se pidieron ${solicitadas}`,
      );
    }
  }

  // 3. Importes en centavos.
  const detalles = lineas.map((l) => {
    const precioCaja = aCentavos(l.precioCaja);
    return {
      manifiestoDetalleId: l.manifiestoDetalleId,
      cajas: l.cajas,
      precioCaja,
      subtotal: multiplicarCentavos(precioCaja, l.cajas),
    };
  });
  return { detalles, total: sumarCentavos(detalles.map((d) => d.subtotal)) };
}

/** Folio consecutivo a partir del mayor existente. */
export function siguienteFolio(folioMayor: number | null | undefined): number {
  return (folioMayor ?? 0) + 1;
}

export function validarCancelacion(ticket: {
  estado: EstadoTicket;
  folio: number;
}): void {
  if (ticket.estado === "CANCELADO") {
    throw new ErrorDeRegla(
      "CONFLICTO",
      `El ticket ${formatearFolio(ticket.folio)} ya estaba cancelado`,
    );
  }
}
