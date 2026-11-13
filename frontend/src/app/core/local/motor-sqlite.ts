/** Valores que se pueden mandar como parámetros "?" de una sentencia. */
export type ValorSql = string | number | null;

/**
 * Lo mínimo que la app necesita de SQLite. El resto del código usa esto y no
 * el plugin, así funciona igual en Android, en el navegador y en las pruebas.
 */
export interface MotorSqlite {
  /** Varias sentencias separadas por ";" y sin parámetros (migraciones, PRAGMA). */
  ejecutarScript(sql: string): Promise<void>;
  /** Una sentencia con parámetros "?"; devuelve cuántas filas cambió. */
  ejecutar(sql: string, valores: readonly ValorSql[]): Promise<number>;
  consultar<T>(sql: string, valores: readonly ValorSql[]): Promise<T[]>;
  iniciarTransaccion(): Promise<void>;
  confirmarTransaccion(): Promise<void>;
  revertirTransaccion(): Promise<void>;
  /** Persiste los cambios: en el navegador los guarda en IndexedDB; en Android no hace nada. */
  guardar(): Promise<void>;
}
