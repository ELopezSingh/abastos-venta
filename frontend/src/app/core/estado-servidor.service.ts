import { Injectable, computed, signal } from '@angular/core';

/**
 * Peticiones que están esperando a que el servidor despierte (503 de
 * Railway en un arranque en frío). La barra de estado lo avisa.
 */
@Injectable({ providedIn: 'root' })
export class EstadoServidorService {
  private readonly esperando = signal(0);

  readonly despertando = computed(() => this.esperando() > 0);

  empezarEspera(): void {
    this.esperando.update((n) => n + 1);
  }

  terminarEspera(): void {
    this.esperando.update((n) => Math.max(0, n - 1));
  }
}
