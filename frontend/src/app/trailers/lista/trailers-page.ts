import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { EstadoTrailer, ManifiestoLineaDto, TrailerDto } from '@abastos/shared';
import { colorDeChile, nombreProducto } from '../../core/catalogos';
import { mensajeDeError, mensajeDeErrorAlGuardar } from '../../core/errores';
import { TrailersApi } from '../trailers.api';
import { TrailersCerrados } from './trailers-cerrados';
import { DatosGuardados } from '../../core/pwa/datos-guardados';
import { AvisoConexionGuardar } from '../../core/pwa/aviso-conexion-guardar';
import { ConexionService } from '../../core/pwa/conexion.service';
import { CAPTURA_HABILITADA } from '../../core/captura';

interface SegmentoExistencia {
  color: string;
  porcentaje: number;
}

@Component({
  selector: 'app-trailers-page',
  imports: [RouterLink, DecimalPipe, TrailersCerrados, DatosGuardados, AvisoConexionGuardar],
  templateUrl: './trailers-page.html',
  styleUrl: './trailers-page.scss',
})
export class TrailersPage {
  private readonly api = inject(TrailersApi);

  protected readonly conexion = inject(ConexionService);

  protected readonly captura = CAPTURA_HABILITADA;

  /** Pestaña visible. Los cerrados se manejan en su propio componente. */
  protected readonly estado = signal<EstadoTrailer>('ACTIVO');
  protected readonly trailers = this.api.listar(signal<EstadoTrailer>('ACTIVO'));

  /** Trailer que está pidiendo confirmación para cerrarse. */
  protected readonly porCerrar = signal<string | null>(null);
  /** Trailer que se está cerrando en este momento. */
  protected readonly procesando = signal<string | null>(null);
  /** Error de la última acción, junto con el trailer donde ocurrió. */
  protected readonly errorAccion = signal<{ id: string; mensaje: string } | null>(null);
  /** Aviso después de cerrar, porque el trailer cambia de pestaña. */
  protected readonly aviso = signal<string | null>(null);

  protected readonly colorDeChile = colorDeChile;
  protected readonly mensajeDeError = mensajeDeError;

  protected cambiarEstado(estado: EstadoTrailer): void {
    this.estado.set(estado);
    this.porCerrar.set(null);
    this.aviso.set(null);
    // Al volver al andén se recarga, por si se reabrió algún trailer en Cerrados.
    if (estado === 'ACTIVO') this.trailers.reload();
  }

  /** Barra de existencias: un tramo por línea del manifiesto, del color del chile. */
  protected segmentos(t: TrailerDto): SegmentoExistencia[] {
    if (t.totales.cajas === 0) return [];
    return t.manifiesto
      .filter((l) => l.disponibles > 0)
      .map((l) => ({
        color: colorDeChile(l.color),
        porcentaje: (l.disponibles / t.totales.cajas) * 100,
      }));
  }

  protected nombreLinea(l: ManifiestoLineaDto): string {
    return nombreProducto(l.producto, l.color);
  }

  protected pedirCierre(id: string): void {
    this.errorAccion.set(null);
    this.aviso.set(null);
    this.porCerrar.set(id);
  }

  protected async cerrar(t: TrailerDto): Promise<void> {
    this.procesando.set(t.id);
    this.errorAccion.set(null);
    try {
      await this.api.cerrar(t.id);
      this.porCerrar.set(null);
      this.aviso.set(`El viaje ${t.viaje ?? t.numero} se pasó a Cerrados.`);
      this.trailers.reload(); // el trailer desaparece de esta pestaña
    } catch (error) {
      this.errorAccion.set({ id: t.id, mensaje: mensajeDeErrorAlGuardar(error) });
    } finally {
      this.procesando.set(null);
    }
  }
}
