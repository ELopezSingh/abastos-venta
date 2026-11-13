import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import type { MotorSqlite, ValorSql } from './motor-sqlite';

/** Si abrir la base tarda más que esto, se muestra un error en lugar de esperar para siempre. */
const LIMITE_APERTURA_MS = 20_000;

/**
 * Base local con @capacitor-community/sqlite: SQLite nativo en Android y
 * jeep-sqlite (sql.js guardado en IndexedDB) en el navegador (tablet-dev).
 * Sustituye a `abrir-sqlite.ts` en las configuraciones android y tablet-dev.
 */
export function abrirSqlite(nombre: string): Promise<MotorSqlite> {
  return conLimite(abrir(nombre), LIMITE_APERTURA_MS, 'La base de la tablet tardó demasiado en abrir.');
}

async function abrir(nombre: string): Promise<MotorSqlite> {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const enNavegador = Capacitor.getPlatform() === 'web';
  if (enNavegador) await prepararNavegador(sqlite);

  // Si la conexión ya existía (por ejemplo, tras una recarga en caliente), se reutiliza.
  const consistentes = (await sqlite.checkConnectionsConsistency()).result;
  const existe = (await sqlite.isConnection(nombre, false)).result;
  const db =
    consistentes && existe
      ? await sqlite.retrieveConnection(nombre, false)
      : await sqlite.createConnection(nombre, false, 'no-encryption', 1, false);

  if (!(await db.isDBOpen()).result) await db.open();
  return new MotorCapacitor(sqlite, db, nombre, enNavegador);
}

/**
 * En el navegador, el plugin necesita el elemento <jeep-sqlite> y su almacén en IndexedDB.
 * Se usa la versión no lazy de jeep-sqlite (dist/components): la lazy (loader) descarga
 * su código con import() relativo, que falla con el servidor de desarrollo de Angular.
 */
async function prepararNavegador(sqlite: SQLiteConnection): Promise<void> {
  const { defineCustomElement } = await import('jeep-sqlite/dist/components/jeep-sqlite');
  if (!customElements.get('jeep-sqlite')) defineCustomElement();
  if (!document.querySelector('jeep-sqlite')) {
    // Busca sql-wasm.wasm en /assets (lo copia scripts/copiar-wasm.mjs).
    document.body.appendChild(document.createElement('jeep-sqlite'));
  }
  await customElements.whenDefined('jeep-sqlite');
  await sqlite.initWebStore();
}

function conLimite<T>(promesa: Promise<T>, ms: number, mensaje: string): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error(mensaje)), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

class MotorCapacitor implements MotorSqlite {
  constructor(
    private readonly sqlite: SQLiteConnection,
    private readonly db: SQLiteDBConnection,
    private readonly nombre: string,
    private readonly enNavegador: boolean,
  ) {}

  async ejecutarScript(sql: string): Promise<void> {
    // transaction = false: las transacciones las maneja BaseLocalService.
    await this.db.execute(sql, false);
  }

  async ejecutar(sql: string, valores: readonly ValorSql[]): Promise<number> {
    const r = await this.db.run(sql, [...valores], false);
    return r.changes?.changes ?? 0;
  }

  async consultar<T>(sql: string, valores: readonly ValorSql[]): Promise<T[]> {
    const r = await this.db.query(sql, [...valores]);
    return (r.values ?? []) as T[];
  }

  async iniciarTransaccion(): Promise<void> {
    await this.db.beginTransaction();
  }

  async confirmarTransaccion(): Promise<void> {
    await this.db.commitTransaction();
  }

  async revertirTransaccion(): Promise<void> {
    await this.db.rollbackTransaction();
  }

  async guardar(): Promise<void> {
    if (this.enNavegador) await this.sqlite.saveToStore(this.nombre);
  }
}
