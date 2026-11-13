import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { abrirSqlite } from './abrir-sqlite';
import { MIGRACIONES, type Migracion } from './esquema';
import type { MotorSqlite, ValorSql } from './motor-sqlite';

export const NOMBRE_BASE = 'abastos';

/** Cómo se abre SQLite; las pruebas lo cambian por un motor falso. */
export const ABRIR_SQLITE = new InjectionToken<(nombre: string) => Promise<MotorSqlite>>(
  'ABRIR_SQLITE',
  { providedIn: 'root', factory: () => abrirSqlite },
);

export const MIGRACIONES_LOCALES = new InjectionToken<readonly Migracion[]>('MIGRACIONES_LOCALES', {
  providedIn: 'root',
  factory: () => MIGRACIONES,
});

export type EstadoBaseLocal = 'cerrada' | 'abriendo' | 'lista' | 'error';

/** Lo que se puede hacer dentro de una transacción. */
export interface Transaccion {
  ejecutar(sql: string, valores?: readonly ValorSql[]): Promise<number>;
  consultar<T>(sql: string, valores?: readonly ValorSql[]): Promise<T[]>;
}

/**
 * Base SQLite de la tablet. Se abre una vez, aplica las migraciones
 * pendientes y atiende una cosa a la vez (hay una sola conexión).
 */
@Injectable({ providedIn: 'root' })
export class BaseLocalService {
  private readonly abrirMotor = inject(ABRIR_SQLITE);
  private readonly migraciones = inject(MIGRACIONES_LOCALES);

  private readonly _estado = signal<EstadoBaseLocal>('cerrada');
  readonly estado = this._estado.asReadonly();
  private readonly _versionEsquema = signal<number | null>(null);
  readonly versionEsquema = this._versionEsquema.asReadonly();
  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  private apertura: Promise<MotorSqlite> | null = null;
  /** Fila de trabajo: cada consulta o transacción espera a que termine la anterior. */
  private fila: Promise<unknown> = Promise.resolve();

  /** Abre y migra la base (solo la primera vez). Si falló, vuelve a intentarlo. */
  async abrir(): Promise<void> {
    await this.motor();
  }

  consultar<T>(sql: string, valores: readonly ValorSql[] = []): Promise<T[]> {
    return this.enFila((m) => m.consultar<T>(sql, valores));
  }

  /** Una sentencia suelta (sin transacción explícita). */
  ejecutar(sql: string, valores: readonly ValorSql[] = []): Promise<number> {
    return this.enFila(async (m) => {
      const cambios = await m.ejecutar(sql, valores);
      await m.guardar();
      return cambios;
    });
  }

  /**
   * Corre `trabajo` en una transacción: si lanza un error, se revierte todo.
   * Dentro usa solo `tx`: llamar a `consultar`/`ejecutar` del servicio
   * esperaría a que termine esta misma transacción y se quedaría trabado.
   */
  transaccion<T>(trabajo: (tx: Transaccion) => Promise<T>): Promise<T> {
    return this.enFila(async (m) => {
      const tx: Transaccion = {
        ejecutar: (sql, valores = []) => m.ejecutar(sql, valores),
        consultar: (sql, valores = []) => m.consultar(sql, valores),
      };
      await m.iniciarTransaccion();
      let resultado: T;
      try {
        resultado = await trabajo(tx);
        await m.confirmarTransaccion();
      } catch (e) {
        await m.revertirTransaccion().catch(() => undefined);
        throw e;
      }
      await m.guardar();
      return resultado;
    });
  }

  private enFila<T>(trabajo: (m: MotorSqlite) => Promise<T>): Promise<T> {
    const resultado = this.fila.then(() => this.motor()).then(trabajo);
    // Un error no debe trabar la fila para lo que sigue.
    this.fila = resultado.catch(() => undefined);
    return resultado;
  }

  private motor(): Promise<MotorSqlite> {
    this.apertura ??= this.abrirYMigrar().catch((e: unknown) => {
      this.apertura = null; // el siguiente intento vuelve a abrir
      this._estado.set('error');
      this._error.set(mensajeDe(e));
      throw e;
    });
    return this.apertura;
  }

  private async abrirYMigrar(): Promise<MotorSqlite> {
    this._estado.set('abriendo');
    this._error.set(null);

    const motor = await this.abrirMotor(NOMBRE_BASE);
    // Debe ir fuera de una transacción y en cada conexión.
    await motor.ejecutarScript('PRAGMA foreign_keys = ON;');

    const actual = await leerVersion(motor);
    const ultima = this.migraciones.at(-1)?.version ?? 0;
    if (actual > ultima) {
      throw new Error(
        `La base de la tablet es de una versión más nueva de la app (esquema v${actual}). Instala la versión más reciente.`,
      );
    }

    for (const m of this.migraciones.filter((m) => m.version > actual)) {
      await motor.iniciarTransaccion();
      try {
        await motor.ejecutarScript(m.sql);
        await motor.ejecutarScript(`PRAGMA user_version = ${m.version};`);
        await motor.confirmarTransaccion();
      } catch (e) {
        await motor.revertirTransaccion().catch(() => undefined);
        throw new Error(
          `No se pudo actualizar la base de la tablet a la versión ${m.version}: ${mensajeDe(e)}`,
        );
      }
      await motor.guardar();
      console.info(`[base local] esquema v${m.version}: ${m.descripcion}`);
    }

    this._versionEsquema.set(await leerVersion(motor));
    this._estado.set('lista');
    return motor;
  }
}

async function leerVersion(motor: MotorSqlite): Promise<number> {
  const [fila] = await motor.consultar<{ user_version: number }>('PRAGMA user_version;', []);
  return Number(fila?.user_version ?? 0);
}

function mensajeDe(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
