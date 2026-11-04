import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Signal, inject } from '@angular/core';
import type {
  CrearTrailerInput,
  EstadoTrailer,
  PaginaTrailersCerradosDto,
  TrailerDto,
} from '@abastos/shared';
import { Observable, firstValueFrom } from 'rxjs';

const URL = '/api/trailers';

@Injectable({ providedIn: 'root' })
export class TrailersApi {
  private readonly http = inject(HttpClient);

  /** Lista reactiva: se vuelve a pedir sola cuando cambia el estado. */
  listar(estado: Signal<EstadoTrailer>) {
    return httpResource<TrailerDto[]>(() => ({ url: URL, params: { estado: estado() } }), {
      defaultValue: [],
    });
  }

  /** Una página de trailers cerrados; "desde" sale de la respuesta anterior. */
  cerrados(q: string, desde: number): Observable<PaginaTrailersCerradosDto> {
    return this.http.get<PaginaTrailersCerradosDto>(`${URL}/cerrados`, {
      params: { desde, ...(q && { q }) },
    });
  }

  crear(datos: CrearTrailerInput): Promise<TrailerDto> {
    return firstValueFrom(this.http.post<TrailerDto>(URL, datos));
  }

  cerrar(id: string): Promise<TrailerDto> {
    return firstValueFrom(this.http.post<TrailerDto>(`${URL}/${id}/cerrar`, {}));
  }

  reabrir(id: string): Promise<TrailerDto> {
    return firstValueFrom(this.http.post<TrailerDto>(`${URL}/${id}/reabrir`, {}));
  }
}
