import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EstadoTabletService } from './estado-tablet.service';
import { haceCuanto, vaAtrasada } from './hace-cuanto';

/**
 * Línea bajo la barra superior de la web: "Última sincronización de la
 * tablet: hace X" y, si hay, las operaciones rechazadas. Lleva a la pantalla
 * de Sincronización. No se muestra si la tablet nunca ha sincronizado.
 */
@Component({
  selector: 'app-estado-tablet',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (vista(); as v) {
      <a class="estado" [class.estado--atrasada]="v.atrasada" routerLink="/sincronizacion">
        <span>Última sincronización de la tablet: {{ v.hace }}</span>
        @if (v.rechazadas > 0) {
          <span class="estado__rechazos">
            {{ v.rechazadas }} {{ v.rechazadas === 1 ? 'rechazada' : 'rechazadas' }}
          </span>
        }
      </a>
    }
  `,
  styles: `
    .estado {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 0.25rem 0.75rem;
      padding: 0.5rem 1rem;
      border-bottom: 1px solid var(--linea);
      background: var(--superficie);
      color: var(--tinta-suave);
      font-size: 0.9rem;
      text-decoration: none;
    }
    .estado--atrasada {
      background: #fef3c7;
      color: #78350f;
    }
    .estado__rechazos {
      color: var(--peligro);
      font-weight: 600;
    }
    @media print {
      .estado {
        display: none;
      }
    }
  `,
})
export class EstadoTablet {
  private readonly servicio = inject(EstadoTabletService);

  protected readonly vista = computed(() => {
    const estado = this.servicio.estado();
    if (!estado?.ultimoContacto) return null;
    const ahora = this.servicio.ahora();
    return {
      hace: haceCuanto(estado.ultimoContacto, ahora),
      atrasada: vaAtrasada(estado.ultimoContacto, ahora),
      rechazadas: estado.rechazadas,
    };
  });
}
