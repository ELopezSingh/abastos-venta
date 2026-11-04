import { httpResource } from '@angular/common/http';
import { Injectable, Signal } from '@angular/core';
import type { LiquidacionTrailerDto, ResumenDiaDto } from '@abastos/shared';

@Injectable({ providedIn: 'root' })
export class ResumenApi {
  /** Resumen de un día (AAAA-MM-DD); se vuelve a pedir cuando cambia la fecha. */
  delDia(fecha: Signal<string>) {
    return httpResource<ResumenDiaDto>(() => ({
      url: '/api/resumen/dia',
      params: { fecha: fecha() },
    }));
  }

  /** Liquidación de un trailer (equivale a la hoja de Excel). */
  liquidacion(trailerId: Signal<string>) {
    return httpResource<LiquidacionTrailerDto>(() => `/api/resumen/trailers/${trailerId()}`);
  }
}
