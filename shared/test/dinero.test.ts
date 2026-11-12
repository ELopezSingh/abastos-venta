import { describe, expect, it } from 'vitest';
import {
  aCentavos,
  aPesos,
  centavosATexto,
  multiplicarCentavos,
  porcentajeDe,
  sumarCentavos,
} from '../src/index.js';

describe('conversión pesos ↔ centavos', () => {
  it('convierte pesos a centavos enteros', () => {
    expect(aCentavos(350.5)).toBe(35050);
    expect(aCentavos(0.1)).toBe(10);
    expect(aCentavos(1.15)).toBe(115); // 1.15 * 100 = 114.99999999999999 en float
  });

  it('regresa a pesos sin basura de punto flotante', () => {
    expect(aPesos(35050)).toBe(350.5);
    expect(aPesos(sumarCentavos([aCentavos(0.1), aCentavos(0.2)]))).toBe(0.3); // 0.1 + 0.2 = 0.30000000000000004 en float
  });

  it('genera el texto exacto para la columna Decimal', () => {
    expect(centavosATexto(0)).toBe('0.00');
    expect(centavosATexto(5)).toBe('0.05');
    expect(centavosATexto(35050)).toBe('350.50');
    expect(centavosATexto(-1234)).toBe('-12.34');
    expect(centavosATexto(123456789012)).toBe('1234567890.12');
  });

  it('rechaza importes que no son enteros o se salen de rango', () => {
    expect(() => centavosATexto(10.5)).toThrow(RangeError);
    expect(() => multiplicarCentavos(Number.MAX_SAFE_INTEGER, 2)).toThrow(RangeError);
  });
});

describe('porcentajeDe (comisión)', () => {
  it('calcula porcentajes exactos', () => {
    expect(porcentajeDe(2021000, 10)).toBe(202100);
    expect(porcentajeDe(10000, 12.5)).toBe(1250);
    expect(porcentajeDe(0, 10)).toBe(0);
  });

  it('redondea la mitad hacia arriba, como Decimal.toDecimalPlaces(2)', () => {
    expect(porcentajeDe(12345, 10)).toBe(1235); // 12.345 → 12.35
    expect(porcentajeDe(12344, 10)).toBe(1234); // 12.344 → 12.34
    expect(porcentajeDe(12346, 10)).toBe(1235); // 12.346 → 12.35
  });

  it('rechaza porcentajes con más de 2 decimales', () => {
    expect(() => porcentajeDe(10000, 10.125)).toThrow(RangeError);
  });
});
