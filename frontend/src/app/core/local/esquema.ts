/**
 * Migraciones de la base local de la tablet. Cada una se aplica una sola vez,
 * en orden y en su propia transacción; la versión aplicada vive en
 * `PRAGMA user_version`. Igual que en el servidor: una migración publicada
 * nunca se edita; los cambios van en una nueva.
 *
 * Convenciones:
 * - Dinero en centavos (INTEGER). La comisión en centésimas de punto: 10 % = 1000.
 * - Fechas como texto ISO en UTC (`Date.toISOString()`), así se pueden comparar como texto.
 * - Ids UUID como texto.
 */
export interface Migracion {
  version: number;
  descripcion: string;
  sql: string;
}

export const MIGRACIONES: readonly Migracion[] = [
  {
    version: 1,
    descripcion: 'Trailers, manifiesto, vales y meta',
    sql: `
      CREATE TABLE trailers (
        id TEXT PRIMARY KEY NOT NULL,
        viaje TEXT,
        placa TEXT NOT NULL,
        numero TEXT NOT NULL,
        invernadero TEXT NOT NULL,
        chofer TEXT NOT NULL,
        anden TEXT NOT NULL,
        costo_anden INTEGER NOT NULL,
        flete INTEGER NOT NULL DEFAULT 0,
        descarga INTEGER NOT NULL DEFAULT 0,
        comision_centesimas INTEGER NOT NULL DEFAULT 1000,
        fecha_llegada TEXT NOT NULL,
        fecha_cierre TEXT,
        estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'CERRADO'))
      );
      CREATE INDEX idx_trailers_estado ON trailers (estado, fecha_cierre);
      CREATE INDEX idx_trailers_llegada ON trailers (fecha_llegada);

      CREATE TABLE manifiesto_detalle (
        id TEXT PRIMARY KEY NOT NULL,
        trailer_id TEXT NOT NULL REFERENCES trailers (id) ON DELETE CASCADE,
        producto TEXT NOT NULL,
        color TEXT,
        tamano TEXT NOT NULL,
        cajas INTEGER NOT NULL
      );
      CREATE INDEX idx_manifiesto_trailer ON manifiesto_detalle (trailer_id);

      CREATE TABLE tickets (
        id TEXT PRIMARY KEY NOT NULL,
        folio INTEGER NOT NULL UNIQUE,
        fecha TEXT NOT NULL,
        cliente_nombre TEXT NOT NULL,
        total INTEGER NOT NULL,
        estado TEXT NOT NULL DEFAULT 'VIGENTE' CHECK (estado IN ('VIGENTE', 'CANCELADO'))
      );
      CREATE INDEX idx_tickets_fecha ON tickets (fecha);

      -- manifiesto_detalle_id va sin llave foránea: un vale puede tener una línea
      -- de un trailer cerrado que no está en la tablet. Por eso el detalle guarda
      -- también trailer, producto, color y tamaño, para mostrarse solo.
      CREATE TABLE ticket_detalle (
        id TEXT PRIMARY KEY NOT NULL,
        ticket_id TEXT NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
        manifiesto_detalle_id TEXT NOT NULL,
        trailer_id TEXT NOT NULL,
        trailer_numero TEXT NOT NULL,
        trailer_anden TEXT NOT NULL,
        producto TEXT NOT NULL,
        color TEXT,
        tamano TEXT NOT NULL,
        cajas INTEGER NOT NULL,
        precio_caja INTEGER NOT NULL,
        subtotal INTEGER NOT NULL
      );
      CREATE INDEX idx_detalle_ticket ON ticket_detalle (ticket_id);
      CREATE INDEX idx_detalle_linea ON ticket_detalle (manifiesto_detalle_id);

      -- Valores sueltos: último folio del servidor, fecha del snapshot, etc.
      CREATE TABLE meta (
        clave TEXT PRIMARY KEY NOT NULL,
        valor TEXT
      );
    `,
  },
];
