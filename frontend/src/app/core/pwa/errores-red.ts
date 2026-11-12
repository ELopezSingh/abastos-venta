import { HttpErrorResponse } from '@angular/common/http';

export const SIN_CONEXION_PREVIA = 'SIN_CONEXION_PREVIA';

export function esErrorDeConexion(error: unknown): boolean {
  if (!navigator.onLine) return true;
  if (error instanceof HttpErrorResponse) {
    // 0: la petición no llegó o no hubo respuesta
    // 504: lo que devuelve el service worker cuando no hay red ni copia guardada
    return error.status === 0 || error.status === 504;
  }
  return false;
}

export function mensajeErrorCarga(error: unknown): string {
  return esErrorDeConexion(error)
    ? 'Sin conexión. Esta información no se ha consultado antes con internet.'
    : 'Ocurrió un error inesperado.';
}

export function mensajeErrorGuardado(error: unknown): string | null {
  if (error instanceof HttpErrorResponse && error.statusText === SIN_CONEXION_PREVIA) {
    return 'No hay conexión. No se guardó nada; inténtalo cuando regrese la señal.';
  }
  if (esErrorDeConexion(error)) {
    return 'Se perdió la conexión al guardar. Revisa en Vales si quedó registrado antes de intentarlo de nuevo.';
  }
  return null;
}
