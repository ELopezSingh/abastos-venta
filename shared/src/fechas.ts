/**
 * Fechas en horario de la CDMX. Las usan el backend, la web y la tablet,
 * para que "el día de hoy" y el día de una venta se calculen igual en todos lados
 * (el servidor en la nube suele estar en UTC).
 */
const ZONA = 'America/Mexico_City';
/** Desde 2022 la CDMX no cambia de horario: siempre UTC-6. */
const DESFASE = '-06:00';
const DIA_MS = 24 * 60 * 60 * 1000;

// El formato en-CA produce exactamente AAAA-MM-DD.
const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA });

/** Día (AAAA-MM-DD) en la CDMX de un instante. */
export function fechaCdmx(instante: Date | string): string {
  return formatoDia.format(typeof instante === 'string' ? new Date(instante) : instante);
}

/** Fecha de hoy en la CDMX con formato AAAA-MM-DD. */
export function hoyCdmx(ahora: Date = new Date()): string {
  return fechaCdmx(ahora);
}

/** Rango [desde, hasta) que cubre el día completo en la CDMX. */
export function rangoDelDia(fecha: string): { desde: Date; hasta: Date } {
  const desde = new Date(`${fecha}T00:00:00${DESFASE}`);
  const hasta = new Date(desde.getTime() + DIA_MS);
  return { desde, hasta };
}

/** Suma (o resta) días a una fecha AAAA-MM-DD. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`); // mediodía UTC: sin sorpresas por zona horaria
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
