import { Prisma } from "../generated/prisma/client.js";

/** number → string con 2 decimales para guardarlo como Decimal sin errores de punto flotante. */
export const aDecimal = (valor: number) => valor.toFixed(2);

/** Decimal de la base → number para el JSON de respuesta. */
export const aNumero = (valor: Prisma.Decimal) => valor.toNumber();

/** Decimal de la base → centavos enteros, para las reglas de @abastos/shared. */
export function centavosDe(valor: Prisma.Decimal): number {
  const centavos = valor.mul(100);
  if (!centavos.isInteger()) {
    throw new Error(`Importe con más de 2 decimales: ${valor.toString()}`);
  }
  return centavos.toNumber();
}
