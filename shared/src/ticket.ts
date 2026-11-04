import { z } from "zod";
import { idSchema } from "./comun.js";
import { cajas, importe } from "./dinero.js";

export const estadoTicketSchema = z.enum(["VIGENTE", "CANCELADO"]);
export type EstadoTicket = z.infer<typeof estadoTicketSchema>;

// ---------- Entradas ----------

export const ticketLineaSchema = z.object({
  /** Línea del manifiesto de la que salen las cajas (define trailer, producto y tamaño). */
  manifiestoDetalleId: idSchema,
  cajas,
  precioCaja: importe.positive("El precio por caja debe ser mayor a 0"),
});

export const crearTicketSchema = z.object({
  clienteNombre: z
    .string()
    .trim()
    .min(1, "El nombre del cliente es obligatorio"),
  lineas: z
    .array(ticketLineaSchema)
    .min(1, "Agrega al menos un producto al ticket"),
});

export const listarTicketsQuerySchema = z.object({
  /** Día a consultar (AAAA-MM-DD). Si no se manda, se usa el día de hoy. */
  fecha: z.iso.date("La fecha debe tener formato AAAA-MM-DD").optional(),
  estado: estadoTicketSchema.optional(),
});

export type TicketLineaInput = z.infer<typeof ticketLineaSchema>;
export type CrearTicketInput = z.infer<typeof crearTicketSchema>;

// ---------- Respuestas del API ----------

export interface TicketLineaDto {
  id: string;
  manifiestoDetalleId: string;
  trailer: { id: string; numero: string; anden: string };
  producto: string;
  color: string | null;
  tamano: string;
  cajas: number;
  precioCaja: number;
  subtotal: number;
}

export interface TicketDto {
  id: string;
  /** Número consecutivo impreso en el ticket. */
  folio: number;
  fecha: string;
  clienteNombre: string;
  estado: EstadoTicket;
  total: number;
  totalCajas: number;
  lineas: TicketLineaDto[];
}
