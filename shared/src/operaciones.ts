import { z } from 'zod';
import { idSchema } from './comun.js';
import { crearTicketSchema, ticketLineaSchema } from './ticket.js';
import {
  actualizarManifiestoLineaSchema,
  actualizarTrailerSchema,
  crearTrailerSchema,
  estadoTrailerSchema,
  manifiestoLineaBase,
  revisarColor,
} from './trailer.js';

/**
 * Operaciones que la tablet registra y manda a POST /api/sync.
 * Cada una lleva los ids que generó la tablet (y el folio, en las ventas),
 * para que su base local y la del servidor queden idénticas.
 */

// ---------- Datos de cada operación ----------

export const manifiestoLineaConIdSchema = manifiestoLineaBase
  .extend({ id: idSchema })
  .superRefine(revisarColor);

export const datosCrearTrailerSchema = crearTrailerSchema.extend({
  id: idSchema,
  manifiesto: z
    .array(manifiestoLineaConIdSchema)
    .min(1, 'Registra al menos un producto del manifiesto'),
});

export const datosActualizarTrailerSchema = z.object({
  trailerId: idSchema,
  cambios: actualizarTrailerSchema,
});

export const datosCambiarEstadoTrailerSchema = z.object({
  trailerId: idSchema,
  estado: estadoTrailerSchema,
});

export const datosAgregarLineaSchema = z.object({
  trailerId: idSchema,
  linea: manifiestoLineaConIdSchema,
});

export const datosActualizarLineaSchema = z.object({
  trailerId: idSchema,
  lineaId: idSchema,
  cambios: actualizarManifiestoLineaSchema,
});

export const datosEliminarLineaSchema = z.object({
  trailerId: idSchema,
  lineaId: idSchema,
});

export const datosCrearTicketSchema = crearTicketSchema.extend({
  id: idSchema,
  folio: z.number().int().positive('El folio debe ser mayor a 0'),
  lineas: z
    .array(ticketLineaSchema.extend({ id: idSchema }))
    .min(1, 'Agrega al menos un producto al ticket'),
});

export const datosCancelarTicketSchema = z.object({ ticketId: idSchema });

// ---------- Operación completa ----------

/** Campos comunes: UUID de la operación y hora en la tablet. */
const sobre = {
  id: idSchema,
  creadaEn: z.iso.datetime({ offset: true }),
};

export const operacionSchema = z.discriminatedUnion('tipo', [
  z.object({ ...sobre, tipo: z.literal('trailer.crear'), datos: datosCrearTrailerSchema }),
  z.object({
    ...sobre,
    tipo: z.literal('trailer.actualizar'),
    datos: datosActualizarTrailerSchema,
  }),
  z.object({
    ...sobre,
    tipo: z.literal('trailer.cambiarEstado'),
    datos: datosCambiarEstadoTrailerSchema,
  }),
  z.object({ ...sobre, tipo: z.literal('linea.agregar'), datos: datosAgregarLineaSchema }),
  z.object({ ...sobre, tipo: z.literal('linea.actualizar'), datos: datosActualizarLineaSchema }),
  z.object({ ...sobre, tipo: z.literal('linea.eliminar'), datos: datosEliminarLineaSchema }),
  z.object({ ...sobre, tipo: z.literal('ticket.crear'), datos: datosCrearTicketSchema }),
  z.object({ ...sobre, tipo: z.literal('ticket.cancelar'), datos: datosCancelarTicketSchema }),
]);

export type Operacion = z.infer<typeof operacionSchema>;
export type TipoOperacion = Operacion['tipo'];
export const TIPOS_OPERACION = operacionSchema.options.map(
  (o) => o.shape.tipo.value,
) as TipoOperacion[];

export type DatosCrearTrailer = z.infer<typeof datosCrearTrailerSchema>;
export type DatosCrearTicket = z.infer<typeof datosCrearTicketSchema>;
