import { z } from 'zod';
import { idSchema } from './comun.js';
import type { TicketDto } from './ticket.js';
import type { TrailerDto } from './trailer.js';

/** Máximo de operaciones por envío; la tablet manda su cola en lotes de este tamaño. */
export const MAX_OPERACIONES_POR_LOTE = 100;

/**
 * Cuerpo de POST /api/sync. Cada operación se valida por separado en el
 * servidor, para que una mal formada no tumbe todo el lote.
 * Un lote vacío solo registra el contacto de la tablet.
 */
export const loteSyncSchema = z.object({
  operaciones: z
    .array(z.unknown())
    .max(MAX_OPERACIONES_POR_LOTE, `Máximo ${MAX_OPERACIONES_POR_LOTE} operaciones por envío`),
});

/** Campos mínimos para identificar una operación y guardar su rechazo. */
export const sobreOperacionSchema = z.object({
  id: idSchema,
  tipo: z.string().min(1),
  creadaEn: z.iso.datetime({ offset: true }),
  datos: z.unknown(),
});

export type EstadoOperacion = 'APLICADA' | 'YA_APLICADA' | 'RECHAZADA';

export interface ResultadoOperacionDto {
  /** null solo si la operación venía sin un id válido. */
  id: string | null;
  estado: EstadoOperacion;
  /** Motivo del rechazo (null si se aplicó). */
  motivo: string | null;
}

export interface RespuestaSyncDto {
  /** Un resultado por operación, en el mismo orden en que se mandaron. */
  resultados: ResultadoOperacionDto[];
  horaServidor: string;
}

/** Carga inicial de la tablet (GET /api/sync/snapshot). */
export interface SnapshotDto {
  generadoEn: string;
  /** Folio más alto registrado; la tablet sigue desde el siguiente. */
  ultimoFolio: number;
  /** Trailers ACTIVO con su manifiesto y existencias. */
  trailers: TrailerDto[];
  /** Todos los tickets (vigentes y cancelados) con alguna línea de un trailer activo. */
  tickets: TicketDto[];
}
