import { Component, inject, signal } from '@angular/core';
import { BaseLocalService } from '../core/local/base-local.service';

interface Conteos {
  trailers: number;
  activos: number;
  vales: number;
}

const SQL_CONTEOS = `
  SELECT
    (SELECT COUNT(*) FROM trailers) AS trailers,
    (SELECT COUNT(*) FROM trailers WHERE estado = 'ACTIVO') AS activos,
    (SELECT COUNT(*) FROM tickets) AS vales`;

/** Ajustes → "Datos en la tablet": estado de la base local. Solo en la tablet. */
@Component({
  selector: 'app-datos-tablet',
  template: `
    <h2 id="titulo-datos-tablet">Datos en la tablet</h2>
    @switch (base.estado()) {
      @case ('lista') {
        <p>Base local lista · esquema v{{ base.versionEsquema() }}</p>
        @if (conteos(); as c) {
          <p class="aviso">
            {{ c.trailers }} trailers ({{ c.activos }} activos) · {{ c.vales }} vales
          </p>
        }
      }
      @case ('error') {
        <p class="error" role="alert">{{ base.error() }}</p>
        <button type="button" class="boton boton--secundario boton--ancho" (click)="revisar()">
          Reintentar
        </button>
      }
      @default {
        <p class="aviso">Abriendo la base de la tablet…</p>
      }
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 0.75rem;
      margin-top: 1rem;
      padding: 1rem;
      background: var(--superficie);
      border: 1px solid var(--linea);
      border-radius: var(--radio);
    }
    h2,
    p {
      margin: 0;
    }
    .aviso {
      color: var(--tinta-suave);
    }
    .error {
      padding: 0.75rem;
      border-radius: var(--radio-chico);
      background: var(--peligro-fondo);
      color: var(--peligro);
    }
  `,
  host: { role: 'region', 'aria-labelledby': 'titulo-datos-tablet' },
})
export class DatosTablet {
  protected readonly base = inject(BaseLocalService);
  protected readonly conteos = signal<Conteos | null>(null);

  constructor() {
    void this.revisar();
  }

  protected async revisar(): Promise<void> {
    try {
      await this.base.abrir();
      const [fila] = await this.base.consultar<Conteos>(SQL_CONTEOS);
      this.conteos.set(fila ?? null);
    } catch {
      // El motivo queda en base.error() y se muestra arriba.
    }
  }
}
