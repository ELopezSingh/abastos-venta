import type { MotorSqlite } from './motor-sqlite';

/**
 * Versión para la web: no hay base local. Las configuraciones `android` y
 * `tablet-dev` reemplazan este archivo por `abrir-sqlite.capacitor.ts`
 * (fileReplacements en angular.json); así el plugin no entra al build de la web.
 */
export function abrirSqlite(_nombre: string): Promise<MotorSqlite> {
  return Promise.reject(new Error('Esta versión de la app no tiene base local.'));
}
