import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal, untracked } from '@angular/core';
import { formatearFolio } from '@abastos/shared';
import { BaseLocalService } from '../core/local/base-local.service';
import { CargaInicialService } from '../core/local/carga-inicial.service';
import { META } from '../core/local/snapshot-local';
import { ConexionService } from '../core/pwa/conexion.service';

interface Resumen {
  activos: number;
  vales: number;
  folio_local: number | null;
  folio_servidor: string | null;
  cargado_en: string | null;
}

const SQL_RESUMEN = `
  SELECT
    (SELECT COUNT(*) FROM trailers WHERE estado = 'ACTIVO') AS activos,
    (SELECT COUNT(*) FROM tickets) AS vales,
    (SELECT MAX(folio) FROM tickets) AS folio_local,
    (SELECT valor FROM meta WHERE clave = '${META.ultimoFolioServidor}') AS folio_servidor,
    (SELECT valor FROM meta WHERE clave = '${META.snapshotCargadoEn}') AS cargado_en`;

/** Ajustes → "Datos en la tablet": estado de la base local y carga desde el servidor. */
@Component({
  selector: 'app-datos-tablet',
  imports: [DatePipe],
  template: `
    <h2 id="titulo-datos-tablet">Datos en la tablet</h2>
    @switch (base.estado()) {
      @case ('lista') {
        @if (resumen(); as r) {
          @if (r.cargado_en) {
            <p>Datos del servidor cargados el {{ r.cargado_en | date: "d 'de' MMMM, HH:mm" }}.</p>
            <p class="aviso">
              {{ r.activos }} trailers activos · {{ r.vales }} vales · último folio
              {{ formatearFolio(ultimoFolio(r)) }}
            </p>
          } @else if (!carga.cargando()) {
            <p class="aviso">La tablet todavía no tiene los datos del servidor.</p>
          }
        }
        @if (carga.cargando()) {
          <p class="aviso">Cargando los datos del servidor…</p>
        }
        @if (carga.error(); as mensaje) {
          <p class="error" role="alert">{{ mensaje }}</p>
        }
        @if (!conexion.enLinea()) {
          <p class="aviso">Sin conexión: podrás cargar los datos cuando regrese la señal.</p>
        }
        <button
          type="button"
          class="boton boton--secundario boton--ancho"
          [disabled]="carga.cargando() || !conexion.enLinea()"
          (click)="cargar()"
        >
          {{
            resumen()?.cargado_en
              ? 'Volver a cargar desde el servidor'
              : 'Cargar datos del servidor'
          }}
        </button>
        <p class="aviso pie">Base local · esquema v{{ base.versionEsquema() }}</p>
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
    .pie {
      font-size: 0.85rem;
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
  protected readonly carga = inject(CargaInicialService);
  protected readonly conexion = inject(ConexionService);
  protected readonly resumen = signal<Resumen | null>(null);
  protected readonly formatearFolio = formatearFolio;

  constructor() {
    // Al entrar y cada vez que termina una carga.
    effect(() => {
      this.carga.cargas();
      untracked(() => void this.revisar());
    });
  }

  /** El siguiente folio sale del mayor entre lo que hay en la tablet y lo que dijo el servidor. */
  protected ultimoFolio(r: Resumen): number {
    return Math.max(r.folio_local ?? 0, Number(r.folio_servidor ?? 0));
  }

  protected async revisar(): Promise<void> {
    try {
      await this.base.abrir();
      const [fila] = await this.base.consultar<Resumen>(SQL_RESUMEN);
      this.resumen.set(fila ?? null);
    } catch {
      // El motivo queda en base.error() y se muestra arriba.
    }
  }

  protected async cargar(): Promise<void> {
    await this.carga.cargar().catch(() => undefined); // el error se muestra desde carga.error()
  }
}
