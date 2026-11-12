import { errorDeColor } from "../catalogos.js";
import { ErrorDeRegla } from "../errores.js";
import type { ActualizarManifiestoLineaInput, EstadoTrailer } from "../trailer.js";

/** Valores que se usan si al crear el trailer no se mandan. */
export const VALORES_POR_DEFECTO_TRAILER = {
  flete: 0,
  descarga: 0,
  comisionPorcentaje: 10,
} as const;

/** "" o undefined → null (producto sin color). */
export const normalizarColor = (color: string | null | undefined) =>
  color || null;

export const disponiblesDeLinea = (cajas: number, vendidas: number) =>
  cajas - vendidas;

/** Al cerrar se guarda cuándo; al reabrir se borra. */
export function fechaCierrePara(estado: EstadoTrailer, ahora: Date): Date | null {
  return estado === "CERRADO" ? ahora : null;
}

/** Revisa la combinación producto/color tal como quedaría después del cambio. */
export function validarColorDeCambio(
  actual: { producto: string; color: string | null },
  cambio: Pick<ActualizarManifiestoLineaInput, "producto" | "color">,
): void {
  const producto = cambio.producto ?? actual.producto;
  const color =
    cambio.color !== undefined ? normalizarColor(cambio.color) : actual.color;
  const error = errorDeColor(producto, color);
  if (error) throw new ErrorDeRegla("INVALIDO", error);
}

/** Una línea no puede quedar con menos cajas de las ya vendidas. */
export function validarCajasDeLinea(cajas: number, vendidas: number): void {
  if (cajas < vendidas) {
    throw new ErrorDeRegla(
      "CONFLICTO",
      `Ya se vendieron ${vendidas} cajas de esta línea; no puede quedar con ${cajas}`,
    );
  }
}

/** `ventasRegistradas` cuenta todas las ventas, también las canceladas. */
export function validarEliminarLinea(ventasRegistradas: number): void {
  if (ventasRegistradas > 0) {
    throw new ErrorDeRegla(
      "CONFLICTO",
      "No se puede eliminar una línea que ya tiene ventas registradas",
    );
  }
}
