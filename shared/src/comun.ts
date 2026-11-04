import { z } from "zod";

/** Id de las entidades: UUID generado en la tablet (o por el servidor). */
export const idSchema = z.uuid("Id inválido");

/** Para validar ids que llegan en la URL (/api/trailers/:id). */
export const idParamSchema = z.object({ id: idSchema });
