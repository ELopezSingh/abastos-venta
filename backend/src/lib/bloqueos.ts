import type { Db } from './prisma.js';

/**
 * Bloquea líneas del manifiesto (FOR UPDATE) hasta que termine la transacción.
 * Así una venta y una corrección de la misma línea no se pisan: la segunda
 * espera a la primera y ya ve sus cambios.
 * Prisma manda el arreglo como text[]; el cast lo vuelve uuid[].
 */
export async function bloquearLineas(tx: Db, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await tx.$queryRaw`
    SELECT id FROM manifiesto_detalle
    WHERE id = ANY(${ids}::uuid[])
    ORDER BY id
    FOR UPDATE`;
}
