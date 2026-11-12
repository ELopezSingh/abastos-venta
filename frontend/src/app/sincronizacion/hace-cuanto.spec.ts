import { registerLocaleData } from '@angular/common';
import localeEsMx from '@angular/common/locales/es-MX';
import { haceCuanto, vaAtrasada } from './hace-cuanto';

registerLocaleData(localeEsMx);

const ahora = new Date('2026-11-12T18:00:00-06:00').getTime();
const antes = (minutos: number) => new Date(ahora - minutos * 60_000).toISOString();

describe('haceCuanto', () => {
  it('menos de un minuto', () => {
    expect(haceCuanto(antes(0.5), ahora)).toBe('hace un momento');
  });

  it('reloj del teléfono atrasado (diferencia negativa)', () => {
    expect(haceCuanto(antes(-3), ahora)).toBe('hace un momento');
  });

  it('minutos y horas', () => {
    expect(haceCuanto(antes(5), ahora)).toBe('hace 5 min');
    expect(haceCuanto(antes(59), ahora)).toBe('hace 59 min');
    expect(haceCuanto(antes(60), ahora)).toBe('hace 1 h');
    expect(haceCuanto(antes(23 * 60 + 59), ahora)).toBe('hace 23 h');
  });

  it('más de un día: fecha y hora', () => {
    expect(haceCuanto(antes(24 * 60 + 5), ahora)).toMatch(/^el \d{1,2} \S+ a las \d{2}:\d{2}$/);
  });
});

describe('vaAtrasada', () => {
  it('a partir de 30 minutos', () => {
    expect(vaAtrasada(antes(30), ahora)).toBe(false);
    expect(vaAtrasada(antes(31), ahora)).toBe(true);
  });
});
