import { describe, expect, it } from 'vitest';
import {
  calcularLiquidacion,
  calcularResumenDia,
  type VentaParaLiquidacion,
} from '../src/index.js';

const venta = (folio: number, cajas: number, precioCaja: number): VentaParaLiquidacion => ({
  ticketId: `ticket-${folio}`,
  folio,
  fecha: '2026-11-10T16:00:00.000Z',
  clienteNombre: `Cliente ${folio}`,
  cajas,
  precioCaja,
  subtotal: precioCaja * cajas,
});

describe('calcularLiquidacion (la hoja del trailer)', () => {
  // Las líneas vienen desordenadas a propósito.
  const liquidacion = calcularLiquidacion(
    [
      {
        producto: 'Morrón',
        color: 'Amarillo',
        tamano: 'XL',
        cajas: 80,
        ventas: [venta(13, 30, 31000)],
      },
      {
        producto: 'Morrón',
        color: 'Rojo',
        tamano: 'LG',
        cajas: 50,
        ventas: [venta(11, 20, 28025)],
      },
      {
        producto: 'Morrón',
        color: 'Rojo',
        tamano: 'XL',
        cajas: 100,
        ventas: [venta(12, 10, 35050), venta(10, 5, 36000)],
      },
    ],
    { flete: 1500000, piso: 35000, descarga: 120000, comisionPorcentaje: 10 },
  );

  it('agrupa por producto y color en el orden del catálogo', () => {
    expect(liquidacion.productos.map((p) => p.producto)).toEqual([
      'Morrón Rojo',
      'Morrón Amarillo',
    ]);
  });

  it('ordena tamaños como la hoja y ventas por folio', () => {
    const rojo = liquidacion.productos[0]!;
    expect(rojo.tamanos.map((t) => t.tamano)).toEqual(['XL', 'LG']);
    expect(rojo.ventas.map((v) => v.folio)).toEqual([10, 11, 12]);
    expect(rojo.tamanos[0]).toEqual({ tamano: 'XL', recibidas: 100, vendidas: 15, quedan: 85 });
    expect(rojo.venta).toBe(10910); // 1800 + 5605 + 3505
  });

  it('cuadra cajas, venta, gastos y balance', () => {
    expect(liquidacion.cajas).toEqual({ entrada: 230, vendidas: 65, quedan: 165 });
    expect(liquidacion.venta).toBe(20210);
    expect(liquidacion.gastos).toEqual({
      flete: 15000,
      piso: 350,
      descarga: 1200,
      comisionPorcentaje: 10,
      comision: 2021,
      total: 18571,
    });
    expect(liquidacion.balance).toBe(1639);
  });

  it('un trailer sin ventas queda con balance = −gastos fijos', () => {
    const vacio = calcularLiquidacion(
      [{ producto: 'Morrón', color: 'Rojo', tamano: 'XL', cajas: 10, ventas: [] }],
      { flete: 100000, piso: 35000, descarga: 0, comisionPorcentaje: 10 },
    );
    expect(vacio.gastos.comision).toBe(0);
    expect(vacio.balance).toBe(-1350);
  });
});

describe('calcularResumenDia', () => {
  const t15 = { id: 'a', viaje: 'Viaje 1', numero: 'T-15', invernadero: 'Inv A' };
  const t09 = { id: 'b', viaje: null, numero: 'T-09', invernadero: 'Inv B' };

  it('suma ventas, cajas y agrupa por trailer de mayor a menor venta', () => {
    const resumen = calcularResumenDia(
      '2026-11-10',
      [
        {
          total: 40000,
          detalles: [
            { cajas: 1, subtotal: 10000, trailer: t15 },
            { cajas: 2, subtotal: 30000, trailer: t09 },
          ],
        },
        { total: 5005, detalles: [{ cajas: 1, subtotal: 5005, trailer: t15 }] },
      ],
      35000,
    );
    expect(resumen).toEqual({
      fecha: '2026-11-10',
      tickets: 2,
      cajasVendidas: 4,
      ventas: 450.05,
      gastosAnden: 350,
      ganancia: 100.05,
      porTrailer: [
        {
          trailerId: 'b',
          viaje: null,
          numero: 'T-09',
          invernadero: 'Inv B',
          cajasVendidas: 2,
          venta: 300,
        },
        {
          trailerId: 'a',
          viaje: 'Viaje 1',
          numero: 'T-15',
          invernadero: 'Inv A',
          cajasVendidas: 2,
          venta: 150.05,
        },
      ],
    });
  });

  it('un día sin ventas da ceros', () => {
    const resumen = calcularResumenDia('2026-11-10', [], 0);
    expect(resumen).toMatchObject({
      tickets: 0,
      cajasVendidas: 0,
      ventas: 0,
      ganancia: 0,
      porTrailer: [],
    });
  });
});
