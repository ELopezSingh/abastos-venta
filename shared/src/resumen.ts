import { z } from "zod";

export const resumenDiaQuerySchema = z.object({
  /** Día a consultar (AAAA-MM-DD). Si no se manda, se usa el día de hoy. */
  fecha: z.iso.date("La fecha debe tener formato AAAA-MM-DD").optional(),
});

// ---------- Resumen del día ----------

export interface ResumenDiaTrailerDto {
  trailerId: string;
  viaje: string | null;
  numero: string;
  invernadero: string;
  cajasVendidas: number;
  venta: number;
}

export interface ResumenDiaDto {
  fecha: string;
  tickets: number;
  cajasVendidas: number;
  ventas: number;
  /** Costo de andén de los trailers que llegaron ese día. */
  gastosAnden: number;
  /** ventas − gastosAnden (definición provisional). */
  ganancia: number;
  porTrailer: ResumenDiaTrailerDto[];
}

// ---------- Liquidación de un trailer (equivale a la hoja de Excel) ----------

export interface LiquidacionTamanoDto {
  tamano: string;
  recibidas: number;
  vendidas: number;
  quedan: number;
}

export interface LiquidacionVentaDto {
  ticketId: string;
  /** Folio impreso del ticket. */
  folio: number;
  fecha: string;
  clienteNombre: string;
  tamano: string;
  cajas: number;
  precioCaja: number;
  subtotal: number;
}

export interface LiquidacionProductoDto {
  /** Producto y color, ej. "Morrón Rojo". */
  producto: string;
  tamanos: LiquidacionTamanoDto[];
  totales: { recibidas: number; vendidas: number; quedan: number };
  venta: number;
  ventas: LiquidacionVentaDto[];
}

export interface LiquidacionTrailerDto {
  trailer: {
    id: string;
    viaje: string | null;
    numero: string;
    placa: string;
    invernadero: string;
    chofer: string;
    anden: string;
    fechaLlegada: string;
    fechaCierre: string | null;
    estado: "ACTIVO" | "CERRADO";
  };
  productos: LiquidacionProductoDto[];
  cajas: { entrada: number; vendidas: number; quedan: number };
  venta: number;
  gastos: {
    flete: number;
    piso: number;
    descarga: number;
    comisionPorcentaje: number;
    comision: number;
    total: number;
  };
  /** venta − gastos.total: lo que se le liquida al dueño de la mercancía. */
  balance: number;
}
