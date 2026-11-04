import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, Signal, inject } from '@angular/core';
import type { CrearTicketInput, TicketDto } from '@abastos/shared';
import { firstValueFrom } from 'rxjs';

const URL = '/api/tickets';

/** En la app les decimos "vales"; en el API son tickets. */
@Injectable({ providedIn: 'root' })
export class ValesApi {
  private readonly http = inject(HttpClient);

  /** Vales de un día (AAAA-MM-DD); se vuelve a pedir solo cuando cambia la fecha. */
  listar(fecha: Signal<string>) {
    return httpResource<TicketDto[]>(() => ({ url: URL, params: { fecha: fecha() } }), {
      defaultValue: [],
    });
  }

  crear(datos: CrearTicketInput): Promise<TicketDto> {
    return firstValueFrom(this.http.post<TicketDto>(URL, datos));
  }

  cancelar(id: string): Promise<TicketDto> {
    return firstValueFrom(this.http.post<TicketDto>(`${URL}/${id}/cancelar`, {}));
  }
}
