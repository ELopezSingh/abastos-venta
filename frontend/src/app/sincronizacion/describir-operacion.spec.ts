import { describirOperacion } from './describir-operacion';

describe('describirOperacion', () => {
  it('venta con folio, cliente y cajas', () => {
    const d = describirOperacion('ticket.crear', {
      folio: 123,
      clienteNombre: 'Don Pepe',
      lineas: [{ cajas: 3 }, { cajas: 2 }],
    });
    expect(d).toEqual({ titulo: 'Venta', detalle: 'Folio 00123 · Don Pepe · 5 cajas' });
  });

  it('alta de trailer', () => {
    const d = describirOperacion('trailer.crear', {
      viaje: 'HORTIFRESH-01',
      numero: 'T-46',
      invernadero: 'Hortifresh',
      manifiesto: [{ cajas: 100 }],
    });
    expect(d.titulo).toBe('Registro de trailer');
    expect(d.detalle).toBe('HORTIFRESH-01 · Trailer T-46 · Hortifresh · 100 cajas');
  });

  it('cierre y reapertura', () => {
    expect(describirOperacion('trailer.cambiarEstado', { estado: 'CERRADO' }).titulo).toBe(
      'Cierre de trailer',
    );
    expect(describirOperacion('trailer.cambiarEstado', { estado: 'ACTIVO' }).titulo).toBe(
      'Reapertura de trailer',
    );
  });

  it('línea agregada', () => {
    const d = describirOperacion('linea.agregar', {
      linea: { producto: 'Morrón', color: 'Rojo', tamano: 'XL', cajas: 1 },
    });
    expect(d.detalle).toBe('Morrón Rojo XL · 1 caja');
  });

  it('datos mal formados no truenan', () => {
    expect(describirOperacion('ticket.crear', null)).toEqual({ titulo: 'Venta', detalle: null });
    expect(describirOperacion('ticket.crear', { folio: 'x', lineas: 'no' }).detalle).toBeNull();
  });

  it('tipo desconocido', () => {
    expect(describirOperacion('ticket.borrar', {}).titulo).toBe(
      'Operación desconocida (ticket.borrar)',
    );
  });
});
