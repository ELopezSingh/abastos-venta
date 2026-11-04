/**
 * Catálogos del negocio. Para vender un producto nuevo
 * basta con agregarlo aquí: el backend lo empieza a aceptar y el frontend lo muestra
 * en las listas. No hace falta migración porque en la base se guarda como texto.
 */

/** Tamaños en el orden en que se manejan en la hoja de liquidación. */
export const TAMANOS = ["XXL", "XL", "LG", "MD", "SM", "CH"] as const;
export type Tamano = (typeof TAMANOS)[number];

/**
 * Productos y los colores en que vienen. Un producto sin colores
 * (lista vacía) no pide color al capturarlo.
 */
export const PRODUCTOS = {
  Morrón: ["Rojo", "Amarillo", "Naranja", "Verde"],
  // Pasilla: [],
} as const satisfies Record<string, readonly string[]>;

export type Producto = keyof typeof PRODUCTOS;
export const NOMBRES_PRODUCTOS = Object.keys(PRODUCTOS) as [
  Producto,
  ...Producto[],
];

/** Colores válidos de un producto (vacío si el producto no maneja color). */
export function coloresDe(producto: string): readonly string[] {
  return PRODUCTOS[producto as Producto] ?? [];
}

/** Revisa que el color corresponda al producto. Devuelve el error o null. */
export function errorDeColor(
  producto: string,
  color: string | null | undefined,
): string | null {
  const colores = coloresDe(producto);
  if (colores.length === 0) {
    return color ? `${producto} no lleva color` : null;
  }
  if (!color) return "Elige el color";
  return colores.includes(color)
    ? null
    : `${producto} no viene en color ${color}`;
}

/** Folio con ceros a la izquierda, como en los vales impresos: 324 → "00324". */
export const DIGITOS_FOLIO = 5;
export function formatearFolio(folio: number): string {
  return String(folio).padStart(DIGITOS_FOLIO, "0");
}

/** Posición del tamaño en el orden de la hoja (los desconocidos van al final). */
export function ordenTamano(tamano: string): number {
  const i = (TAMANOS as readonly string[]).indexOf(tamano.toUpperCase());
  return i === -1 ? TAMANOS.length : i;
}

/** Posición del color según el catálogo del producto (los desconocidos van al final). */
function ordenColor(producto: string, color: string | null): number {
  if (!color) return -1;
  const i = coloresDe(producto).indexOf(color);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

export interface LineaOrdenable {
  producto: string;
  color: string | null;
  tamano: string;
}

/**
 * Orden de las líneas de manifiesto y de ticket: producto, color (como en el
 * catálogo) y tamaño (como en la hoja). Sustituye al orden por id, que con
 * UUID ya no refleja el orden de captura.
 */
export function compararLineas(a: LineaOrdenable, b: LineaOrdenable): number {
  return (
    a.producto.localeCompare(b.producto, "es") ||
    ordenColor(a.producto, a.color) - ordenColor(b.producto, b.color) ||
    ordenTamano(a.tamano) - ordenTamano(b.tamano)
  );
}

