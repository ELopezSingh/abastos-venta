import { describe, expect, it } from 'vitest';
import {
  ErrorDeRegla,
  fechaCierrePara,
  prepararTicket,
  siguienteFolio,
  validarCajasDeLinea,
  validarCancelacion,
  validarColorDeCambio,
  validarEliminarLinea,
  type LineaManifiestoParaVenta,
} from '../src/index.js';

const ROJO_XL = '11111111-1111-4111-8111-111111111111';
const ROJO_LG = '22222222-2222-4222-8222-222222222222';
const CERRADO = '33333333-3333-4333-8333-333333333333';
const NO_EXISTE = '99999999-9999-4999-8999-999999999999';

const manifiesto = new Map<string, LineaManifiestoParaVenta>([
  [
    ROJO_XL,
    {
      producto: 'Morrón',
      color: 'Rojo',
      tamano: 'XL',
      cajas: 100,
      trailer: { numero: 'T-15', estado: 'ACTIVO' },
    },
  ],
  [
    ROJO_LG,
    {
      producto: 'Morrón',
      color: 'Rojo',
      tamano: 'LG',
      cajas: 50,
      trailer: { numero: 'T-15', estado: 'ACTIVO' },
    },
  ],
  [
    CERRADO,
    {
      producto: 'Morrón',
      color: 'Verde',
      tamano: 'MD',
      cajas: 40,
      trailer: { numero: 'T-09', estado: 'CERRADO' },
    },
  ],
]);
const sinVentas = new Map<string, number>();

/** Ejecuta la función y regresa el ErrorDeRegla que lanzó. */
function errorDe(fn: () => unknown): ErrorDeRegla {
  try {
    fn();
  } catch (e) {
    if (e instanceof ErrorDeRegla) return e;
    throw e;
  }
  throw new Error('Se esperaba un ErrorDeRegla y no se lanzó ninguno');
}

describe('prepararTicket', () => {
  it('calcula subtotales y total en centavos', () => {
    const { detalles, total } = prepararTicket(
      [
        { manifiestoDetalleId: ROJO_XL, cajas: 3, precioCaja: 33.33 },
        { manifiestoDetalleId: ROJO_LG, cajas: 10, precioCaja: 280.25 },
      ],
      manifiesto,
      sinVentas,
    );
    expect(detalles.map((d) => d.subtotal)).toEqual([9999, 280250]);
    expect(total).toBe(290249); // 99.99 + 2802.50 = 2902.49
  });

  it('permite vender exactamente lo que queda', () => {
    expect(() =>
      prepararTicket(
        [{ manifiestoDetalleId: ROJO_XL, cajas: 30, precioCaja: 300 }],
        manifiesto,
        new Map([[ROJO_XL, 70]]),
      ),
    ).not.toThrow();
  });

  it('rechaza vender más de lo que queda (con el mismo mensaje de antes)', () => {
    const e = errorDe(() =>
      prepararTicket(
        [{ manifiestoDetalleId: ROJO_XL, cajas: 31, precioCaja: 300 }],
        manifiesto,
        new Map([[ROJO_XL, 70]]),
      ),
    );
    expect(e.tipo).toBe('CONFLICTO');
    expect(e.message).toBe('Solo quedan 30 cajas de Morrón Rojo XL (trailer T-15); se pidieron 31');
  });

  it('suma las cajas cuando la misma línea viene dos veces', () => {
    const e = errorDe(() =>
      prepararTicket(
        [
          { manifiestoDetalleId: ROJO_LG, cajas: 30, precioCaja: 280 },
          { manifiestoDetalleId: ROJO_LG, cajas: 21, precioCaja: 270 },
        ],
        manifiesto,
        sinVentas,
      ),
    );
    expect(e.message).toBe('Solo quedan 50 cajas de Morrón Rojo LG (trailer T-15); se pidieron 51');
  });

  it('rechaza vender de un trailer cerrado', () => {
    const e = errorDe(() =>
      prepararTicket(
        [{ manifiestoDetalleId: CERRADO, cajas: 1, precioCaja: 100 }],
        manifiesto,
        sinVentas,
      ),
    );
    expect(e.tipo).toBe('CONFLICTO');
    expect(e.message).toBe('El trailer T-09 está cerrado; no se puede vender de él');
  });

  it('rechaza líneas que ya no existen', () => {
    const e = errorDe(() =>
      prepararTicket(
        [{ manifiestoDetalleId: NO_EXISTE, cajas: 1, precioCaja: 100 }],
        manifiesto,
        sinVentas,
      ),
    );
    expect(e.tipo).toBe('NO_ENCONTRADO');
  });
});

describe('folio y cancelación', () => {
  it('el primer folio es 1 y luego sigue el consecutivo', () => {
    expect(siguienteFolio(null)).toBe(1);
    expect(siguienteFolio(324)).toBe(325);
  });

  it('no deja cancelar dos veces', () => {
    expect(() => validarCancelacion({ estado: 'VIGENTE', folio: 324 })).not.toThrow();
    const e = errorDe(() => validarCancelacion({ estado: 'CANCELADO', folio: 324 }));
    expect(e.tipo).toBe('CONFLICTO');
    expect(e.message).toBe('El ticket 00324 ya estaba cancelado');
  });
});

describe('correcciones al manifiesto', () => {
  const actual = { producto: 'Morrón', color: 'Rojo' };

  it('valida el color tal como quedaría después del cambio', () => {
    expect(() => validarColorDeCambio(actual, { color: 'Amarillo' })).not.toThrow();
    expect(() => validarColorDeCambio(actual, {})).not.toThrow();
    expect(errorDe(() => validarColorDeCambio(actual, { color: 'Morado' })).tipo).toBe('INVALIDO');
    expect(errorDe(() => validarColorDeCambio(actual, { color: '' })).message).toBe(
      'Elige el color',
    );
  });

  it('no deja bajar las cajas de lo ya vendido', () => {
    expect(() => validarCajasDeLinea(30, 30)).not.toThrow();
    expect(errorDe(() => validarCajasDeLinea(29, 30)).message).toBe(
      'Ya se vendieron 30 cajas de esta línea; no puede quedar con 29',
    );
  });

  it('no deja eliminar líneas con ventas', () => {
    expect(() => validarEliminarLinea(0)).not.toThrow();
    expect(errorDe(() => validarEliminarLinea(1)).tipo).toBe('CONFLICTO');
  });

  it('guarda la fecha de cierre solo al cerrar', () => {
    const ahora = new Date('2026-11-10T18:00:00Z');
    expect(fechaCierrePara('CERRADO', ahora)).toBe(ahora);
    expect(fechaCierrePara('ACTIVO', ahora)).toBeNull();
  });
});
