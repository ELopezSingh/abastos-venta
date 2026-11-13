import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize, retry, throwError, timer } from 'rxjs';
import { EstadoServidorService } from './estado-servidor.service';

/** Reintentos después del primer 503 (cada uno puede tardar ~20 s en el servidor). */
export const MAX_REINTENTOS_503 = 3;
const ESPERA_POR_DEFECTO_S = 5;
const ESPERA_MAXIMA_S = 15;

/**
 * Solo se reintenta lo que no puede duplicar nada: las consultas y el login.
 * Un POST que guarda (vale, trailer, cancelar…) pudo haberse aplicado antes de
 * que se cayera la conexión; repetirlo a ciegas podría duplicar un vale.
 */
function sePuedeReintentar(req: HttpRequest<unknown>): boolean {
  if (!/(^|\/)api\//.test(req.url)) return false;
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  return req.method === 'POST' && /(^|\/)api\/auth\/login$/.test(req.url);
}

/** Lo que pide el servidor en Retry-After, con un tope. */
function segundosDeEspera(error: HttpErrorResponse): number {
  const pedido = Number(error.headers?.get('Retry-After'));
  if (!Number.isFinite(pedido) || pedido <= 0) return ESPERA_POR_DEFECTO_S;
  return Math.min(pedido, ESPERA_MAXIMA_S);
}

/**
 * Cuando el servicio de Railway acaba de despertar, el backend responde 503
 * ("El servidor está despertando…"). En lugar de mostrar el error, se espera
 * lo que indica Retry-After y se vuelve a intentar, hasta MAX_REINTENTOS_503
 * veces. Mientras tanto, la barra de estado avisa que el servidor despierta.
 */
export const reintento503Interceptor: HttpInterceptorFn = (req, next) => {
  if (!sePuedeReintentar(req)) return next(req);

  const servidor = inject(EstadoServidorService);
  let avisando = false;

  return next(req).pipe(
    retry({
      count: MAX_REINTENTOS_503,
      delay: (error: unknown) => {
        if (!(error instanceof HttpErrorResponse) || error.status !== 503) {
          return throwError(() => error);
        }
        if (!avisando) {
          avisando = true;
          servidor.empezarEspera();
        }
        return timer(segundosDeEspera(error) * 1000);
      },
    }),
    // También corre si la pantalla cancela la petición (por ejemplo, al salir).
    finalize(() => {
      if (avisando) servidor.terminarEspera();
    }),
  );
};
