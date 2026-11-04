import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  FormField,
  applyEach,
  form,
  submit,
  validate,
  validateStandardSchema,
} from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import {
  crearTicketSchema,
  formatearFolio,
  type ManifiestoLineaDto,
  type TicketDto,
  type TrailerDto,
} from '@abastos/shared';
import { colorDeChile, nombreProducto } from '../../core/catalogos';
import { ErrorCampo } from '../../core/error-campo';
import { mensajeDeError, mensajeDeErrorAlGuardar } from '../../core/errores';
import { TrailersApi } from '../../trailers/trailers.api';
import { ValesApi } from '../vales.api';
import { DatosGuardados } from '../../core/pwa/datos-guardados';
import { AvisoConexionGuardar } from '../../core/pwa/aviso-conexion-guardar';
import { ConexionService } from '../../core/pwa/conexion.service';

interface LineaVale {
  manifiestoDetalleId: string;
  cajas: number;
  precioCaja: number;
}

interface ModeloVale {
  clienteNombre: string;
  lineas: LineaVale[];
}

/** Lo que se muestra de cada producto disponible: la línea del manifiesto y su trailer. */
interface ProductoDisponible {
  linea: ManifiestoLineaDto;
  trailer: TrailerDto;
}

const valeVacio = (): ModeloVale => ({ clienteNombre: '', lineas: [] });

@Component({
  selector: 'app-nuevo-vale-page',
  imports: [
    FormField,
    ErrorCampo,
    RouterLink,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    DatosGuardados,
    AvisoConexionGuardar,
  ],
  templateUrl: './nuevo-vale-page.html',
  styleUrl: './nuevo-vale-page.scss',
})
export class NuevoValePage {
  private readonly valesApi = inject(ValesApi);
  protected readonly conexion = inject(ConexionService);

  protected readonly hoy = new Date();
  protected readonly trailers = inject(TrailersApi).listar(signal('ACTIVO'));

  /** Productos disponibles indexados por id de línea de manifiesto. */
  protected readonly disponibles = computed(() => {
    const mapa = new Map<string, ProductoDisponible>();
    for (const trailer of this.trailers.value()) {
      for (const linea of trailer.manifiesto) mapa.set(linea.id, { linea, trailer });
    }
    return mapa;
  });

  protected readonly modelo = signal<ModeloVale>(valeVacio());

  protected readonly f = form(this.modelo, (ruta) => {
    // Reglas compartidas con el backend.
    validateStandardSchema(ruta, crearTicketSchema);

    // Aviso inmediato si piden más cajas de las que quedan. El backend lo vuelve
    // a revisar al guardar, por si otra venta se llevó las cajas mientras tanto.
    applyEach(ruta.lineas, (linea) => {
      validate(linea.cajas, ({ value, valueOf }) => {
        const quedan = this.disponibles().get(valueOf(linea.manifiestoDetalleId))?.linea
          .disponibles;
        if (quedan !== undefined && value() > quedan) {
          return { kind: 'existencias', message: `Solo quedan ${quedan} cajas` };
        }
        return null;
      });
    });
  });

  /** Total que se ve en pantalla; el que se guarda lo calcula el backend. */
  protected readonly total = computed(() =>
    this.modelo().lineas.reduce((acc, l) => acc + this.importe(l), 0),
  );

  protected readonly errorServidor = signal<string | null>(null);
  protected readonly guardado = signal<TicketDto | null>(null);

  protected readonly colorDeChile = colorDeChile;
  protected readonly nombreProducto = nombreProducto;
  protected readonly formatearFolio = formatearFolio;
  protected readonly mensajeDeError = mensajeDeError;

  protected importe(l: LineaVale): number {
    return Math.round((Number(l.cajas) || 0) * (Number(l.precioCaja) || 0) * 100) / 100;
  }

  protected enVale(lineaId: string): boolean {
    return this.modelo().lineas.some((l) => l.manifiestoDetalleId === lineaId);
  }

  protected agregar(lineaId: string): void {
    if (this.enVale(lineaId)) return;
    this.modelo.update((m) => ({
      ...m,
      lineas: [...m.lineas, { manifiestoDetalleId: lineaId, cajas: 0, precioCaja: 0 }],
    }));
  }

  protected quitar(indice: number): void {
    this.modelo.update((m) => ({ ...m, lineas: m.lineas.filter((_, i) => i !== indice) }));
  }

  /** Al tocar un campo numérico se selecciona su contenido, para escribir encima del 0. */
  protected seleccionar(evento: FocusEvent): void {
    (evento.target as HTMLInputElement).select();
  }

  protected async guardar(evento: SubmitEvent): Promise<void> {
    evento.preventDefault();
    this.errorServidor.set(null);
    await submit(this.f, async () => {
      try {
        const vale = await this.valesApi.crear(crearTicketSchema.parse(this.modelo()));
        this.guardado.set(vale);
        this.trailers.reload(); // actualiza las existencias para el siguiente vale
      } catch (error) {
        this.errorServidor.set(mensajeDeErrorAlGuardar(error));
      }
      return undefined;
    });
  }

  protected nuevoVale(): void {
    this.f().reset(valeVacio());
    this.guardado.set(null);
    this.errorServidor.set(null);
  }
}
