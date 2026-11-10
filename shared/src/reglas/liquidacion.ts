import { compararLineas, ordenTamano } from "../catalogos.js";
import { aPesos, porcentajeDe, sumarCentavos, type Centavos } from "../dinero.js";
import type {
  LiquidacionProductoDto,
  LiquidacionTrailerDto,
} from "../resumen.js";
import { nombreDeLinea } from "./ventas.js";

export interface VentaParaLiquidacion {
  ticketId: string;
  folio: number;
  /** ISO 8601. */
  fecha: string;
  clienteNombre: string;
  cajas: number;
  precioCaja: Centavos;
  subtotal: Centavos;
}

export interface LineaParaLiquidacion {
  producto: string;
  color: string | null;
  tamano: string;
  cajas: number;
  /** Solo ventas de tickets VIGENTE. */
  ventas: readonly VentaParaLiquidacion[];
}

export interface GastosParaLiquidacion {
  flete: Centavos;
  /** Costo de andén. */
  piso: Centavos;
  descarga: Centavos;
  comisionPorcentaje: number;
}

export type CalculoLiquidacion = Omit<LiquidacionTrailerDto, "trailer">;

export function calcularLiquidacion(
  lineas: readonly LineaParaLiquidacion[],
  gastos: GastosParaLiquidacion,
): CalculoLiquidacion {
  // Agrupar por producto + color (como cada bloque de la hoja), en orden fijo.
  const grupos = new Map<string, LineaParaLiquidacion[]>();
  for (const linea of [...lineas].sort(compararLineas)) {
    const nombre = nombreDeLinea(linea.producto, linea.color);
    grupos.set(nombre, [...(grupos.get(nombre) ?? []), linea]);
  }

  const productos: LiquidacionProductoDto[] = [];
  const ventasPorProducto: Centavos[] = [];

  for (const [producto, grupo] of grupos) {
    const tamanos = grupo
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

    const ventas = grupo
      .flatMap((l) => l.ventas.map((v) => ({ ...v, tamano: l.tamano })))
      .sort((a, b) => a.folio - b.folio);
    const ventaProducto = sumarCentavos(ventas.map((v) => v.subtotal));
    ventasPorProducto.push(ventaProducto);

    productos.push({
      producto,
      tamanos,
      totales: {
        recibidas: tamanos.reduce((acc, t) => acc + t.recibidas, 0),
        vendidas: tamanos.reduce((acc, t) => acc + t.vendidas, 0),
        quedan: tamanos.reduce((acc, t) => acc + t.quedan, 0),
      },
      venta: aPesos(ventaProducto),
      ventas: ventas.map((v) => ({
        ticketId: v.ticketId,
        folio: v.folio,
        fecha: v.fecha,
        clienteNombre: v.clienteNombre,
        tamano: v.tamano,
        cajas: v.cajas,
        precioCaja: aPesos(v.precioCaja),
        subtotal: aPesos(v.subtotal),
      })),
    });
  }

  // Gastos: flete + piso + descarga + comisión (porcentaje sobre la venta).
  const venta = sumarCentavos(ventasPorProducto);
  const comision = porcentajeDe(venta, gastos.comisionPorcentaje);
  const totalGastos = sumarCentavos([
    gastos.flete,
    gastos.piso,
    gastos.descarga,
    comision,
  ]);

  const suma = (campo: "recibidas" | "vendidas" | "quedan") =>
    productos.reduce((acc, p) => acc + p.totales[campo], 0);

  return {
    productos,
    cajas: {
      entrada: suma("recibidas"),
      vendidas: suma("vendidas"),
      quedan: suma("quedan"),
    },
    venta: aPesos(venta),
    gastos: {
      flete: aPesos(gastos.flete),
      piso: aPesos(gastos.piso),
      descarga: aPesos(gastos.descarga),
      comisionPorcentaje: gastos.comisionPorcentaje,
      comision: aPesos(comision),
      total: aPesos(totalGastos),
    },
    balance: aPesos(venta - totalGastos),
  };
}
