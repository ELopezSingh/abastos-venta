import { DatePipe, JsonPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { mensajeDeError } from '../core/errores';
import { DatosGuardados } from '../core/pwa/datos-guardados';
import { describirOperacion } from './describir-operacion';
import { EstadoTabletService } from './estado-tablet.service';
import { haceCuanto } from './hace-cuanto';
import { SyncApi } from './sync.api';

/** Pantalla de Sincronización: último contacto de la tablet y operaciones rechazadas. */
@Component({
  selector: 'app-rechazadas-page',
  imports: [DatePipe, JsonPipe, DatosGuardados],
  templateUrl: './rechazadas-page.html',
  styleUrl: './rechazadas-page.scss',
})
export class RechazadasPage {
  private readonly estadoTablet = inject(EstadoTabletService);

  protected readonly rechazadas = inject(SyncApi).rechazadas();
  protected readonly estado = this.estadoTablet.estado;

  protected readonly hace = computed(() => {
    const iso = this.estado()?.ultimoContacto;
    return iso ? haceCuanto(iso, this.estadoTablet.ahora()) : null;
  });

  /** Cada rechazo con su título y detalle listos para mostrar. */
  protected readonly operaciones = computed(() =>
    this.rechazadas.hasValue()
      ? this.rechazadas.value().operaciones.map((op) => ({
          ...op,
          ...describirOperacion(op.tipo, op.datos),
        }))
      : [],
  );

  protected readonly mensajeDeError = mensajeDeError;

  constructor() {
    // Al entrar, el estado también se actualiza (no espera al siguiente minuto).
    this.estadoTablet.revisar();
  }

  protected actualizar(): void {
    this.rechazadas.reload();
    this.estadoTablet.revisar();
  }
}
