import { z } from 'zod';

/**
 * Importe en pesos con máximo 2 decimales.
 * Viaja como number en JSON, pero el backend lo guarda como Decimal
 * y hace ahí los cálculos de totales (nunca sumar dinero en el frontend
 * como fuente de verdad).
 */
export const importe = z
  .number()
  .finite()
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, {
    message: 'Máximo 2 decimales',
  });

export const cajas = z.number().int('Las cajas deben ser un número entero').positive('Debe ser al menos 1 caja');

/** Importe en centavos (entero). 12.50 pesos → 1250. */
export type Centavos = number;

function comprobarEntero(valor: number): number {
  if (!Number.isSafeInteger(valor)) {
    throw new RangeError(`Importe fuera de rango o no entero: ${valor}`);
  }
  return valor;
}

/** Pesos (máximo 2 decimales, ya validados con `importe`) → centavos. */
export function aCentavos(pesos: number): Centavos {
  return comprobarEntero(Math.round(pesos * 100));
}

/** Centavos → pesos, para el JSON de respuesta. */
export function aPesos(centavos: Centavos): number {
  return comprobarEntero(centavos) / 100;
}

/** Centavos → texto "1234.50" (exacto), para guardarlo en una columna Decimal. */
export function centavosATexto(centavos: Centavos): string {
  comprobarEntero(centavos);
  const signo = centavos < 0 ? "-" : "";
  const abs = Math.abs(centavos);
  const resto = abs % 100;
  return `${signo}${(abs - resto) / 100}.${String(resto).padStart(2, "0")}`;
}

export function sumarCentavos(valores: readonly Centavos[]): Centavos {
  return comprobarEntero(valores.reduce((acc, v) => acc + v, 0));
}

/** Precio por caja × número de cajas. */
export function multiplicarCentavos(centavos: Centavos, veces: number): Centavos {
  return comprobarEntero(centavos * veces);
}

/**
 * Porcentaje (máximo 2 decimales, ej. 12.5) de un importe, redondeado al centavo
 * con "mitad hacia arriba", igual que Decimal.toDecimalPlaces(2).
 */
export function porcentajeDe(base: Centavos, porcentaje: number): Centavos {
  const puntosBase = Math.round(porcentaje * 100); // 12.5 % → 1250
  if (Math.abs(porcentaje * 100 - puntosBase) > 1e-6) {
    throw new RangeError(`El porcentaje admite máximo 2 decimales: ${porcentaje}`);
  }
  const producto = comprobarEntero(Math.abs(base) * puntosBase);
  const resto = producto % 10_000;
  const cociente = (producto - resto) / 10_000;
  return Math.sign(base) * (cociente + (resto * 2 >= 10_000 ? 1 : 0));
}
