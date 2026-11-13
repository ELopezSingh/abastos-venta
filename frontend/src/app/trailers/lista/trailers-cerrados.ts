import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import type { TrailerCerradoDto } from '@abastos/shared';
import {
  EMPTY,
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  switchMap,
  tap,
} from 'rxjs';
import { mensajeDeError, mensajeDeErrorAlGuardar } from '../../core/errores';
import { TrailersApi } from '../trailers.api';
import { AvisoConexionGuardar } from '../../core/pwa/aviso-conexion-guardar';
import { ConexionService } from '../../core/pwa/conexion.service';
import { CAPTURA_HABILITADA } from '../../core/captura';

interface Pedido {
  q: string;
  desde: number;
}

/** Pestaña "Cerrados": tarjetas compactas, búsqueda y "Ver más". */
@Component({
  selector: 'app-trailers-cerrados',
  imports: [RouterLink, DatePipe, DecimalPipe, AvisoConexionGuardar],
  templateUrl: './trailers-cerrados.html',
  styleUrl: './trailers-cerrados.scss',
})
export class TrailersCerrados {
  private readonly api = inject(TrailersApi);

  protected readonly conexion = inject(ConexionService);

  protected readonly captura = CAPTURA_HABILITADA;

  protected readonly busqueda = signal('');
  protected readonly trailers = signal<TrailerCerradoDto[]>([]);
  /** "desde" de la siguiente página, o null si ya se mostraron todos. */
  protected readonly siguiente = signal<number | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly reabriendo = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  /** Cada búsqueda o "Ver más" es un pedido; switchMap descarta respuestas viejas. */
  private readonly pedidos = new Subject<Pedido>();
  private ultimoPedido: Pedido = { q: '', desde: 0 };

  constructor() {
    const destroyRef = inject(DestroyRef);

    this.pedidos
      .pipe(
        tap((p) => {
          this.ultimoPedido = p;
          this.cargando.set(true);
          this.error.set(null);
        }),
        switchMap((p) =>
          this.api.cerrados(p.q, p.desde).pipe(
            map((pagina) => ({ p, pagina })),
            catchError((e) => {
              this.error.set(mensajeDeError(e));
              this.cargando.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(({ p, pagina }) => {
        // Página 1 reemplaza la lista; las siguientes se agregan al final.
        this.trailers.update((actuales) =>
          p.desde === 0 ? pagina.trailers : [...actuales, ...pagina.trailers],
        );
        this.siguiente.set(pagina.siguiente);
        this.cargando.set(false);
      });

    // Busca 300 ms después de que se deja de escribir.
    toObservable(this.busqueda)
      .pipe(
        map((q) => q.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((q) => this.pedidos.next({ q, desde: 0 }));
  }

  protected escribir(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  protected verMas(): void {
    const desde = this.siguiente();
    if (desde !== null) this.pedidos.next({ q: this.ultimoPedido.q, desde });
  }

  protected reintentar(): void {
    this.pedidos.next(this.ultimoPedido);
  }

  protected async reabrir(t: TrailerCerradoDto): Promise<void> {
    this.reabriendo.set(t.id);
    this.aviso.set(null);
    this.error.set(null);
    try {
      await this.api.reabrir(t.id);
      this.trailers.update((lista) => lista.filter((x) => x.id !== t.id));
      this.aviso.set(`El viaje ${t.viaje ?? t.numero} volvió al andén.`);
    } catch (e) {
      this.error.set(mensajeDeErrorAlGuardar(e));
    } finally {
      this.reabriendo.set(null);
    }
  }
}
