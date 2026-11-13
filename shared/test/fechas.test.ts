import { describe, expect, it } from 'vitest';
import { fechaCdmx, hoyCdmx, rangoDelDia, sumarDias } from '../src/index.js';

describe('fechas en la CDMX', () => {
  it('a las 23:30 en la CDMX sigue siendo el mismo día, aunque en UTC ya sea mañana', () => {
    expect(fechaCdmx('2026-11-14T05:30:00Z')).toBe('2026-11-13');
  });

  it('a las 00:30 en la CDMX ya es el día siguiente', () => {
    expect(fechaCdmx('2026-11-14T06:30:00Z')).toBe('2026-11-14');
  });

  it('acepta horas con zona (como creadaEn de la tablet)', () => {
    expect(fechaCdmx('2026-11-13T23:59:00-06:00')).toBe('2026-11-13');
  });

  it('hoyCdmx usa el instante que se le da', () => {
    expect(hoyCdmx(new Date('2026-01-01T05:59:59Z'))).toBe('2025-12-31');
  });

  it('rangoDelDia cubre 24 h desde la medianoche de la CDMX', () => {
    const { desde, hasta } = rangoDelDia('2026-11-13');
    expect(desde.toISOString()).toBe('2026-11-13T06:00:00.000Z');
    expect(hasta.toISOString()).toBe('2026-11-14T06:00:00.000Z');
  });

  it('sumarDias cruza meses y años', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });
});
