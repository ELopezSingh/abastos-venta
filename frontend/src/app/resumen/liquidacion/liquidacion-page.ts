import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatearFolio } from '@abastos/shared';
import { colorDeChile } from '../../core/catalogos';
import { mensajeDeError } from '../../core/errores';
import { ResumenApi } from '../resumen.api';
import { DatosGuardados } from '../../core/pwa/datos-guardados';

@Component({
  selector: 'app-liquidacion-page',
  imports: [RouterLink, CurrencyPipe, DatePipe, DecimalPipe, DatosGuardados],
  templateUrl: './liquidacion-page.html',
  styleUrl: './liquidacion-page.scss',
})
export class LiquidacionPage {
  /** Viene de la ruta /trailers/:id/liquidacion (withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly liquidacion = inject(ResumenApi).liquidacion(this.id);

  protected readonly titulo = computed(() => {
    const t = this.liquidacion.value()?.trailer;
    return t ? `Liquidación ${t.viaje ?? t.numero}` : 'Liquidación';
  });

  protected readonly colorDeChile = colorDeChile;
  protected readonly formatearFolio = formatearFolio;
  protected readonly mensajeDeError = mensajeDeError;

  /** Abre el diálogo del sistema: en el iPhone permite guardar como PDF o compartir. */
  protected imprimir(): void {
    window.print();
  }
}
