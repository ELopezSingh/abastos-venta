import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { EstadoTrailer } from '@abastos/shared';
import { mensajeDeError } from '../core/errores';
import { hoyCdmx } from '../core/fechas';
import { DatosGuardados } from '../core/pwa/datos-guardados';
import { ResumenApi } from '../resumen/resumen.api';
import { TrailersApi } from '../trailers/trailers.api';

/** Inicio de la web (solo consulta): cómo va el día y qué queda en el andén. */
@Component({
  selector: 'app-inicio-page',
  imports: [RouterLink, CurrencyPipe, DatePipe, DecimalPipe, DatosGuardados],
  templateUrl: './inicio-page.html',
  styleUrl: './inicio-page.scss',
})
export class InicioPage {
  // Mismas URLs que Resumen, Trailers y la precarga: comparten la copia guardada sin red.
  protected readonly hoy = hoyCdmx();
  protected readonly resumen = inject(ResumenApi).delDia(signal(this.hoy));
  protected readonly trailers = inject(TrailersApi).listar(signal<EstadoTrailer>('ACTIVO'));

  protected readonly mensajeDeError = mensajeDeError;
}
