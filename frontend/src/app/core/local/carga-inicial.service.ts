import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, Injector, effect, inject, signal } from '@angular/core';
import type { SnapshotDto } from '@abastos/shared';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { mensajeDeError } from '../errores';
import { BaseLocalService } from './base-local.service';
import { META, guardarSnapshot } from './snapshot-local';

/**
 * Carga inicial de la tablet con GET /api/sync/snapshot: al instalarla, al
 * reinstalarla o cuando se pide desde Ajustes.
 */
@Injectable({ providedIn: 'root' })
export class CargaInicialService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(BaseLocalService);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);

  private readonly _cargando = signal(false);
  readonly cargando = this._cargando.asReadonly();
  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();
  /** Sube cada vez que se cargan datos, para que las pantallas se refresquen. */
  private readonly _cargas = signal(0);
  readonly cargas = this._cargas.asReadonly();

  /** Se llama una vez al arrancar la tablet. */
  iniciar(): void {
    effect(
      () => {
        if (this.auth.autenticado()) void this.cargarSiHaceFalta();
      },
      { injector: this.injector },
    );
    // Si la primera carga falló por falta de señal, se reintenta al recuperarla.
    window.addEventListener('online', () => {
      if (this.auth.autenticado()) void this.cargarSiHaceFalta();
    });
  }

  async estaCargada(): Promise<boolean> {
    const filas = await this.base.consultar<{ valor: string }>(
      'SELECT valor FROM meta WHERE clave = ?',
      [META.snapshotCargadoEn],
    );
    return filas.length > 0;
  }

  /** Carga el snapshot solo si la tablet aún no tiene datos. Los errores quedan en `error`. */
  async cargarSiHaceFalta(): Promise<void> {
    try {
      if (await this.estaCargada()) return;
    } catch {
      return; // la base no abrió: el motivo está en BaseLocalService.error
    }
    await this.cargar().catch(() => undefined);
  }

  /** Reemplaza los datos de la tablet por los del servidor. */
  async cargar(): Promise<void> {
    if (this._cargando()) return;
    this._cargando.set(true);
    this._error.set(null);
    try {
      // 4c: aquí se revisará que no haya operaciones pendientes en la cola.
      const snap = await firstValueFrom(this.http.get<SnapshotDto>('/api/sync/snapshot'));
      await guardarSnapshot(this.base, snap, new Date());
      this._cargas.update((n) => n + 1);
    } catch (e) {
      this._error.set(
        e instanceof HttpErrorResponse
          ? mensajeDeError(e)
          : `No se pudieron guardar los datos en la tablet: ${e instanceof Error ? e.message : e}`,
      );
      throw e;
    } finally {
      this._cargando.set(false);
    }
  }
}
