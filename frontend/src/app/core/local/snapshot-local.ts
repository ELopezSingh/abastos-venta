import { aCentavos, type SnapshotDto, type TicketDto, type TrailerDto } from '@abastos/shared';
import type { BaseLocalService } from './base-local.service';
import type { ValorSql } from './motor-sqlite';

/** Claves de la tabla `meta` que escribe la carga del snapshot. */
export const META = {
  snapshotGeneradoEn: 'snapshot_generado_en',
  snapshotCargadoEn: 'snapshot_cargado_en',
  ultimoFolioServidor: 'ultimo_folio_servidor',
} as const;

export interface Sentencia {
  sql: string;
  valores: ValorSql[];
}

/** Cualquier fecha ISO (con o sin zona) → ISO en UTC, para que se comparen bien como texto. */
const isoUtc = (fecha: string) => new Date(fecha).toISOString();

/** Porcentaje con 2 decimales → centésimas exactas (12.5 % → 1250). */
export const aCentesimas = (porcentaje: number) => Math.round(porcentaje * 100);

function sentenciasTrailer(t: TrailerDto): Sentencia[] {
  return [
    {
      sql: `INSERT INTO trailers (id, viaje, placa, numero, invernadero, chofer, anden,
              costo_anden, flete, descarga, comision_centesimas, fecha_llegada, fecha_cierre, estado)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      valores: [
        t.id,
        t.viaje,
        t.placa,
        t.numero,
        t.invernadero,
        t.chofer,
        t.anden,
        aCentavos(t.costoAnden),
        aCentavos(t.flete),
        aCentavos(t.descarga),
        aCentesimas(t.comisionPorcentaje),
        isoUtc(t.fechaLlegada),
        t.fechaCierre ? isoUtc(t.fechaCierre) : null,
        t.estado,
      ],
    },
    ...t.manifiesto.map((l) => ({
      sql: `INSERT INTO manifiesto_detalle (id, trailer_id, producto, color, tamano, cajas)
            VALUES (?, ?, ?, ?, ?, ?)`,
      valores: [l.id, t.id, l.producto, l.color, l.tamano, l.cajas],
    })),
  ];
}

function sentenciasTicket(v: TicketDto): Sentencia[] {
  return [
    {
      sql: `INSERT INTO tickets (id, folio, fecha, cliente_nombre, total, estado)
            VALUES (?, ?, ?, ?, ?, ?)`,
      valores: [v.id, v.folio, isoUtc(v.fecha), v.clienteNombre, aCentavos(v.total), v.estado],
    },
    ...v.lineas.map((d) => ({
      sql: `INSERT INTO ticket_detalle (id, ticket_id, manifiesto_detalle_id, trailer_id,
              trailer_numero, trailer_anden, producto, color, tamano, cajas, precio_caja, subtotal)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      valores: [
        d.id,
        v.id,
        d.manifiestoDetalleId,
        d.trailer.id,
        d.trailer.numero,
        d.trailer.anden,
        d.producto,
        d.color,
        d.tamano,
        d.cajas,
        aCentavos(d.precioCaja),
        aCentavos(d.subtotal),
      ],
    })),
  ];
}

/**
 * Sentencias que reemplazan los datos de la tablet por los del snapshot:
 * primero borra (hijos antes que padres) y luego inserta. Función pura, para probarla.
 */
export function sentenciasDeSnapshot(snap: SnapshotDto, cargadoEn: Date): Sentencia[] {
  const meta = (clave: string, valor: string): Sentencia => ({
    sql: 'INSERT OR REPLACE INTO meta (clave, valor) VALUES (?, ?)',
    valores: [clave, valor],
  });
  return [
    { sql: 'DELETE FROM ticket_detalle', valores: [] },
    { sql: 'DELETE FROM tickets', valores: [] },
    { sql: 'DELETE FROM manifiesto_detalle', valores: [] },
    { sql: 'DELETE FROM trailers', valores: [] },
    ...snap.trailers.flatMap(sentenciasTrailer),
    ...snap.tickets.flatMap(sentenciasTicket),
    meta(META.snapshotGeneradoEn, isoUtc(snap.generadoEn)),
    meta(META.ultimoFolioServidor, String(snap.ultimoFolio)),
    meta(META.snapshotCargadoEn, cargadoEn.toISOString()),
  ];
}

/** Guarda el snapshot en una sola transacción: si algo falla, la tablet queda como estaba. */
export function guardarSnapshot(
  base: BaseLocalService,
  snap: SnapshotDto,
  cargadoEn: Date,
): Promise<void> {
  const sentencias = sentenciasDeSnapshot(snap, cargadoEn);
  return base.transaccion(async (tx) => {
    for (const s of sentencias) await tx.ejecutar(s.sql, s.valores);
  });
}
