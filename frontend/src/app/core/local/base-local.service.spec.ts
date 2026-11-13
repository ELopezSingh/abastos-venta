import { TestBed } from '@angular/core/testing';
import { ABRIR_SQLITE, BaseLocalService, MIGRACIONES_LOCALES } from './base-local.service';
import type { Migracion } from './esquema';
import type { MotorSqlite, ValorSql } from './motor-sqlite';

/** Motor en memoria que solo anota lo que se le pide. */
class MotorFalso implements MotorSqlite {
  version = 0;
  registro: string[] = [];
  fallarCon: string | null = null;
  private versionPendiente: number | null = null;

  async ejecutarScript(sql: string): Promise<void> {
    if (this.fallarCon && sql.includes(this.fallarCon)) throw new Error('falla simulada');
    const v = /PRAGMA user_version = (\d+)/.exec(sql);
    if (v) this.versionPendiente = Number(v[1]);
    this.registro.push(sql.trim());
  }
  async ejecutar(sql: string, _valores: readonly ValorSql[]): Promise<number> {
    this.registro.push(sql);
    return 1;
  }
  async consultar<T>(sql: string): Promise<T[]> {
    if (sql.startsWith('PRAGMA user_version')) return [{ user_version: this.version } as T];
    this.registro.push(sql);
    return [];
  }
  async iniciarTransaccion(): Promise<void> {
    this.registro.push('BEGIN');
  }
  async confirmarTransaccion(): Promise<void> {
    if (this.versionPendiente !== null) this.version = this.versionPendiente;
    this.versionPendiente = null;
    this.registro.push('COMMIT');
  }
  async revertirTransaccion(): Promise<void> {
    this.versionPendiente = null;
    this.registro.push('ROLLBACK');
  }
  async guardar(): Promise<void> {
    this.registro.push('GUARDAR');
  }
}

const MIGRACIONES: Migracion[] = [
  { version: 1, descripcion: 'uno', sql: 'CREATE TABLE uno (x);' },
  { version: 2, descripcion: 'dos', sql: 'CREATE TABLE dos (x);' },
];

function crear(motor: MotorFalso): BaseLocalService {
  TestBed.configureTestingModule({
    providers: [
      { provide: ABRIR_SQLITE, useValue: () => Promise.resolve(motor) },
      { provide: MIGRACIONES_LOCALES, useValue: MIGRACIONES },
    ],
  });
  return TestBed.inject(BaseLocalService);
}

describe('BaseLocalService', () => {
  it('una base nueva aplica las migraciones en orden', async () => {
    const motor = new MotorFalso();
    const base = crear(motor);
    await base.abrir();

    expect(motor.version).toBe(2);
    expect(base.estado()).toBe('lista');
    expect(base.versionEsquema()).toBe(2);
    expect(motor.registro.filter((s) => s.startsWith('CREATE'))).toEqual([
      'CREATE TABLE uno (x);',
      'CREATE TABLE dos (x);',
    ]);
  });

  it('una base al día no vuelve a migrar', async () => {
    const motor = new MotorFalso();
    motor.version = 2;
    await crear(motor).abrir();
    expect(motor.registro.some((s) => s.startsWith('CREATE'))).toBe(false);
  });

  it('si una migración falla se revierte y la base queda en la versión anterior', async () => {
    const motor = new MotorFalso();
    motor.fallarCon = 'dos';
    const base = crear(motor);

    await expect(base.abrir()).rejects.toThrow(/versión 2/);
    expect(motor.version).toBe(1);
    expect(motor.registro).toContain('ROLLBACK');
    expect(base.estado()).toBe('error');
  });

  it('rechaza una base de una versión más nueva de la app', async () => {
    const motor = new MotorFalso();
    motor.version = 5;
    const base = crear(motor);

    await expect(base.abrir()).rejects.toThrow(/más nueva/);
    expect(base.estado()).toBe('error');
  });

  it('una transacción que falla se revierte', async () => {
    const motor = new MotorFalso();
    motor.version = 2;
    const base = crear(motor);
    await base.abrir();
    motor.registro = [];

    await expect(
      base.transaccion(async (tx) => {
        await tx.ejecutar('INSERT 1');
        throw new Error('algo salió mal');
      }),
    ).rejects.toThrow('algo salió mal');
    expect(motor.registro).toEqual(['BEGIN', 'INSERT 1', 'ROLLBACK']);
  });

  it('atiende una transacción a la vez', async () => {
    const motor = new MotorFalso();
    motor.version = 2;
    const base = crear(motor);
    await base.abrir();
    motor.registro = [];

    const a = base.transaccion(async (tx) => {
      await tx.ejecutar('A1');
      await new Promise((r) => setTimeout(r, 0));
      await tx.ejecutar('A2');
    });
    const b = base.transaccion(async (tx) => {
      await tx.ejecutar('B1');
    });
    await Promise.all([a, b]);

    expect(motor.registro.filter((s) => s !== 'GUARDAR')).toEqual([
      'BEGIN',
      'A1',
      'A2',
      'COMMIT',
      'BEGIN',
      'B1',
      'COMMIT',
    ]);
  });
});
