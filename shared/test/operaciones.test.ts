import { describe, expect, it } from 'vitest';
import { operacionSchema, TIPOS_OPERACION } from '../src/index.js';

const OP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TRAILER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LINEA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const TICKET = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const DETALLE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const creadaEn = '2026-11-10T07:15:00-06:00';

const trailer = {
  id: TRAILER,
  viaje: 'HORTIFRESH-01',
  placa: 'ABC-123',
  numero: 'T-15',
  invernadero: 'Inv A',
  chofer: 'Juan',
  anden: '4',
  costoAnden: 350,
  manifiesto: [{ id: LINEA, producto: 'Morrón', color: 'Rojo', tamano: 'XL', cajas: 100 }],
};

describe('operacionSchema', () => {
  it('acepta un alta de trailer con ids de la tablet', () => {
    expect(
      operacionSchema.safeParse({ id: OP, creadaEn, tipo: 'trailer.crear', datos: trailer })
        .success,
    ).toBe(true);
  });

  it('revisa el color también en las líneas con id', () => {
    const mal = { ...trailer, manifiesto: [{ ...trailer.manifiesto[0], color: 'Morado' }] };
    expect(
      operacionSchema.safeParse({ id: OP, creadaEn, tipo: 'trailer.crear', datos: mal }).success,
    ).toBe(false);
  });

  it('exige folio e ids en las ventas', () => {
    const venta = {
      id: TICKET,
      folio: 325,
      clienteNombre: 'Don Pepe',
      lineas: [{ id: DETALLE, manifiestoDetalleId: LINEA, cajas: 3, precioCaja: 350.5 }],
    };
    expect(
      operacionSchema.safeParse({ id: OP, creadaEn, tipo: 'ticket.crear', datos: venta }).success,
    ).toBe(true);
    const { folio: _, ...sinFolio } = venta;
    expect(
      operacionSchema.safeParse({ id: OP, creadaEn, tipo: 'ticket.crear', datos: sinFolio })
        .success,
    ).toBe(false);
  });

  it('rechaza tipos desconocidos y horas sin zona', () => {
    expect(
      operacionSchema.safeParse({ id: OP, creadaEn, tipo: 'ticket.borrar', datos: {} }).success,
    ).toBe(false);
    expect(
      operacionSchema.safeParse({
        id: OP,
        creadaEn: '2026-11-10T07:15:00',
        tipo: 'ticket.cancelar',
        datos: { ticketId: TICKET },
      }).success,
    ).toBe(false);
  });

  it('no deja una corrección vacía', () => {
    const op = {
      id: OP,
      creadaEn,
      tipo: 'trailer.actualizar',
      datos: { trailerId: TRAILER, cambios: {} },
    };
    expect(operacionSchema.safeParse(op).success).toBe(false);
  });

  it('lista los 8 tipos', () => {
    expect(TIPOS_OPERACION).toHaveLength(8);
  });
});
