import { Injectable, inject, linkedSignal, signal } from '@angular/core';
import type { EstadoSyncDto } from '@abastos/shared';
import { AuthService } from '../core/auth/auth.service';
import { SyncApi } from './sync.api';

const REVISAR_CADA_MS = 60_000;
const RELOJ_CADA_MS = 30_000;

/**
 * Estado de la sincronización de la tablet, para el aviso
 * "Última sincronización de la tablet: hace X". Se revisa cada minuto
 * mientras la app está visible y al volver a ella.
 */
@Injectable({ providedIn: 'root' })
export class EstadoTabletService {
  private readonly auth = inject(AuthService);
  private readonly recurso = inject(SyncApi).estado(() => this.auth.autenticado());

  /** Último estado recibido; se conserva aunque una revisión falle. */
  readonly estado = linkedSignal<EstadoSyncDto | undefined, EstadoSyncDto | undefined>({
    source: () => (this.recurso.hasValue() ? this.recurso.value() : undefined),
    computation: (nuevo, previo) => nuevo ?? previo?.value,
  });

  /** Reloj para recalcular "hace X" sin volver a pedir datos. */
  readonly ahora = signal(Date.now());

  constructor() {
    setInterval(() => this.ahora.set(Date.now()), RELOJ_CADA_MS);
    setInterval(() => this.revisar(), REVISAR_CADA_MS);
    document.addEventListener('visibilitychange', () => this.revisar());
  }

  /** Vuelve a pedir el estado si tiene sentido (visible, con red y con sesión). */
  revisar(): void {
    if (document.visibilityState !== 'visible' || !navigator.onLine) return;
    if (!this.auth.autenticado()) return;
    this.ahora.set(Date.now());
    this.recurso.reload();
  }
}
