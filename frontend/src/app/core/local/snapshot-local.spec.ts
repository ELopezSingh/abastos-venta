import type { SnapshotDto, TicketDto, TrailerDto } from '@abastos/shared';
import { META, sentenciasDeSnapshot, type Sentencia } from './snapshot-local';

const trailer: TrailerDto = {
  id: 'tr-1',
  viaje: 'HORTI-01',
  placa: 'ABC-123',
  numero: 'T-46',
  invernadero: 'Invernadero',
  chofer: 'Juan',
  anden: '12',
  costoAnden: 1500.5,
  flete: 0,
  descarga: 250.25,
  comisionPorcentaje: 12.5,
  fechaLlegada: '2026-11-16T08:00:00-06:00', // con zona: se guarda en UTC
  fechaCierre: null,
  estado: 'ACTIVO',
  manifiesto: [
    {
      id: 'li-1',
      producto: 'Morrón',
      color: 'Rojo',
      tamano: 'XL',
      cajas: 100,
      vendidas: 3,
      disponibles: 97,
    },
  ],
  totales: { cajas: 100, vendidas: 3, disponibles: 97 },
};

const vale: TicketDto = {
  id: 'tk-1',
  folio: 457,
  fecha: '2026-11-16T15:30:00.000Z',
  clienteNombre: 'Don Pepe',
  estado: 'VIGENTE',
  total: 99.99,
  totalCajas: 3,
  lineas: [
    {
      id: 'de-1',
      manifiestoDetalleId: 'li-1',
      trailer: { id: 'tr-1', numero: 'T-46', anden: '12' },
      producto: 'Morrón',
      color: 'Rojo',
      tamano: 'XL',
      cajas: 3,
      precioCaja: 33.33,
      subtotal: 99.99,
    },
  ],
};

const snapshot: SnapshotDto = {
  generadoEn: '2026-11-17T18:00:00.000Z',
  ultimoFolio: 460,
  trailers: [trailer],
  tickets: [vale],
};

const cargadoEn = new Date('2026-11-17T18:00:05.000Z');

function insercion(sentencias: Sentencia[], tabla: string): Sentencia {
  const s = sentencias.find((x) => x.sql.startsWith(`INSERT INTO ${tabla} `));
  if (!s) throw new Error(`No hay INSERT en ${tabla}`);
  return s;
}

describe('sentenciasDeSnapshot', () => {
  const sentencias = sentenciasDeSnapshot(snapshot, cargadoEn);

  it('primero borra, de los hijos a los padres', () => {
    expect(sentencias.slice(0, 4).map((s) => s.sql)).toEqual([
      'DELETE FROM ticket_detalle',
      'DELETE FROM tickets',
      'DELETE FROM manifiesto_detalle',
      'DELETE FROM trailers',
    ]);
  });

  it('guarda el trailer con dinero en centavos, comisión en centésimas y fecha en UTC', () => {
    expect(insercion(sentencias, 'trailers').valores).toEqual([
      'tr-1',
      'HORTI-01',
      'ABC-123',
      'T-46',
      'Invernadero',
      'Juan',
      '12',
      150050,
      0,
      25025,
      1250,
      '2026-11-16T14:00:00.000Z',
      null,
      'ACTIVO',
    ]);
    expect(insercion(sentencias, 'manifiesto_detalle').valores).toEqual([
      'li-1',
      'tr-1',
      'Morrón',
      'Rojo',
      'XL',
      100,
    ]);
  });

  it('guarda el vale y su detalle con los datos del trailer', () => {
    expect(insercion(sentencias, 'tickets').valores).toEqual([
      'tk-1',
      457,
      '2026-11-16T15:30:00.000Z',
      'Don Pepe',
      9999,
      'VIGENTE',
    ]);
    expect(insercion(sentencias, 'ticket_detalle').valores).toEqual([
      'de-1',
      'tk-1',
      'li-1',
      'tr-1',
      'T-46',
      '12',
      'Morrón',
      'Rojo',
      'XL',
      3,
      3333,
      9999,
    ]);
  });

  it('anota el último folio del servidor y cuándo se cargó', () => {
    const meta = Object.fromEntries(
      sentencias
        .filter((s) => s.sql.startsWith('INSERT OR REPLACE INTO meta'))
        .map((s) => s.valores),
    );
    expect(meta).toEqual({
      [META.snapshotGeneradoEn]: '2026-11-17T18:00:00.000Z',
      [META.ultimoFolioServidor]: '460',
      [META.snapshotCargadoEn]: '2026-11-17T18:00:05.000Z',
    });
  });

  it('no deja nada fuera', () => {
    // 4 borrados + trailer + línea + vale + detalle + 3 de meta
    expect(sentencias).toHaveLength(11);
  });
});
