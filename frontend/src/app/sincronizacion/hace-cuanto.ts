import { formatDate } from '@angular/common';

const MINUTO = 60_000;
const HORA = 60 * MINUTO;

/** A partir de cuántos minutos sin contacto se avisa que la tablet va atrasada. */
export const MINUTOS_ATRASO = 30;

/**
 * "hace un momento", "hace 5 min", "hace 3 h" o, después de un día,
 * "el 10 nov a las 18:05". Si el reloj del teléfono va atrasado respecto al
 * servidor, la diferencia sale negativa y se toma como "hace un momento".
 */
export function haceCuanto(iso: string, ahora: number): string {
  const fecha = new Date(iso);
  const diferencia = Math.max(0, ahora - fecha.getTime());
  if (diferencia < MINUTO) return 'hace un momento';
  if (diferencia < HORA) return `hace ${Math.floor(diferencia / MINUTO)} min`;
  if (diferencia < 24 * HORA) return `hace ${Math.floor(diferencia / HORA)} h`;
  return `el ${formatDate(fecha, "d MMM 'a las' HH:mm", 'es-MX')}`;
}

export function vaAtrasada(iso: string, ahora: number): boolean {
  return ahora - new Date(iso).getTime() > MINUTOS_ATRASO * MINUTO;
}
