import { z } from "zod";
import { NOMBRES_PRODUCTOS, TAMANOS, errorDeColor } from "./catalogos.js";
import { cajas, importe } from "./dinero.js";

const texto = (mensaje: string) => z.string(mensaje).trim().min(1, mensaje);

export const estadoTrailerSchema = z.enum(["ACTIVO", "CERRADO"]);
export type EstadoTrailer = z.infer<typeof estadoTrailerSchema>;

// ---------- Entradas ----------

export const manifiestoLineaBase = z.object({
  producto: z.enum(NOMBRES_PRODUCTOS, "Elige un producto de la lista"),
  color: z.string().trim().optional(),
  tamano: z.enum(TAMANOS, "Elige un tamaño"),
  cajas,
});

/** Revisa que el color corresponda al producto (para usar con .superRefine). */
export function revisarColor(
  linea: { producto: string; color?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  const error = errorDeColor(linea.producto, linea.color);
  if (error) ctx.addIssue({ code: "custom", path: ["color"], message: error });
}

export const manifiestoLineaSchema = manifiestoLineaBase.superRefine(revisarColor);

export const crearTrailerSchema = z.object({
  viaje: texto("El nombre del viaje es obligatorio"),
  placa: texto("La placa es obligatoria"),
  numero: texto("El número de trailer es obligatorio"),
  invernadero: texto("El invernadero es obligatorio"),
  chofer: texto("El chofer es obligatorio"),
  anden: texto("El andén es obligatorio"),
  costoAnden: importe.nonnegative("El costo de andén no puede ser negativo"),
  // Opcionales: si no se mandan, el backend usa 0 de flete/descarga y 10 % de comisión.
  // (No se usa .default() porque en Zod 4 también se aplicaría en el PATCH
  // y sobrescribiría valores ya guardados).
  flete: importe.nonnegative("El flete no puede ser negativo").optional(),
  descarga: importe.nonnegative("La descarga no puede ser negativa").optional(),
  comisionPorcentaje: importe
    .min(0, "La comisión no puede ser negativa")
    .max(100, "La comisión no puede ser mayor a 100 %")
    .optional(),
  manifiesto: z
    .array(manifiestoLineaSchema)
    .min(1, "Registra al menos un producto del manifiesto"),
});

/** Corrige datos generales del trailer (no toca el manifiesto). */
export const actualizarTrailerSchema = crearTrailerSchema
  .omit({ manifiesto: true })
  .partial()
  .refine(
    (d) => Object.keys(d).length > 0,
    "No se envió ningún campo para actualizar",
  );

// La combinación producto/color de una corrección parcial se revisa en el backend,
// porque ahí se conoce la línea completa ya guardada.
export const actualizarManifiestoLineaSchema = manifiestoLineaBase
  .partial()
  .refine(
    (d) => Object.keys(d).length > 0,
    "No se envió ningún campo para actualizar",
  );

export const listarTrailersQuerySchema = z.object({
  estado: estadoTrailerSchema.optional(),
});

export const listarCerradosQuerySchema = z.object({
  /** Texto a buscar en viaje, número de trailer, invernadero o placa. */
  q: z.string().trim().max(100).optional(),
  /** Cuántos saltarse (para "Ver más"). */
  desde: z.coerce.number().int().min(0).default(0),
});

export const manifiestoLineaParamsSchema = z.object({
  id: z.uuid("Id de trailer inválido"),
  lineaId: z.uuid("Id de línea inválido"),
});

export type ManifiestoLineaInput = z.infer<typeof manifiestoLineaSchema>;
export type CrearTrailerInput = z.infer<typeof crearTrailerSchema>;
export type ActualizarTrailerInput = z.infer<typeof actualizarTrailerSchema>;
export type ActualizarManifiestoLineaInput = z.infer<
  typeof actualizarManifiestoLineaSchema
>;

// ---------- Respuestas del API ----------

export interface ManifiestoLineaDto {
  id: string;
  producto: string;
  color: string | null;
  tamano: string;
  cajas: number;
  vendidas: number;
  disponibles: number;
}

export interface TrailerDto {
  id: string;
  viaje: string | null;
  placa: string;
  numero: string;
  invernadero: string;
  chofer: string;
  anden: string;
  costoAnden: number;
  flete: number;
  descarga: number;
  comisionPorcentaje: number;
  fechaLlegada: string;
  fechaCierre: string | null;
  estado: EstadoTrailer;
  manifiesto: ManifiestoLineaDto[];
  totales: { cajas: number; vendidas: number; disponibles: number };
}

/** Versión compacta para la lista de trailers cerrados. */
export interface TrailerCerradoDto {
  id: string;
  viaje: string | null;
  numero: string;
  invernadero: string;
  placa: string;
  fechaLlegada: string;
  fechaCierre: string | null;
  cajas: number;
  vendidas: number;
}

export interface PaginaTrailersCerradosDto {
  trailers: TrailerCerradoDto[];
  /** Valor de "desde" para pedir la siguiente página, o null si ya no hay más. */
  siguiente: number | null;
}
