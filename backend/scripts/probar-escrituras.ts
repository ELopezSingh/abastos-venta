/**
 * Prueba las funciones "aplicar" contra la base local SIN dejar datos:
 * todo corre en una transacción que al final se revierte.
 *
 * Uso (desde backend/): npx tsx scripts/probar-escrituras.ts
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import {
  aplicarCancelarTicket,
  aplicarCrearTicket,
} from '../src/modules/tickets/tickets.service.js';
import {
  aplicarActualizarLinea,
  aplicarAgregarLinea,
  aplicarCambiarEstado,
  aplicarCrearTrailer,
  aplicarEliminarLinea,
  type CrearTrailerConIds,
} from '../src/modules/trailers/trailers.service.js';

class Revertir extends Error {
  constructor() {
    super('revertir');
  }
}

let fallas = 0;
function comprobar(ok: boolean, texto: string) {
  console.log(`${ok ? '✓' : '✗'} ${texto}`);
  if (!ok) fallas++;
}
async function fallaCon(texto: string, mensaje: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    comprobar(false, `${texto} (no lanzó error)`);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    comprobar(m.includes(mensaje), `${texto} → "${m}"`);
  }
}

// Como si la tablet lo hubiera hecho ayer sin señal.
const llegada = new Date('2026-11-09T07:15:00-06:00');
const cierre = new Date('2026-11-09T18:00:00-06:00');

try {
  await prisma.$transaction(
    async (tx) => {
      // ---------- Trailer ----------
      const trailerId = randomUUID();
      const rojo = randomUUID();
      const amarillo = randomUUID();
      const alta: CrearTrailerConIds = {
        viaje: 'PRUEBA-01',
        placa: 'PRUEBA',
        numero: 'PRUEBA-1',
        invernadero: 'Prueba',
        chofer: 'Prueba',
        anden: '0',
        costoAnden: 350,
        manifiesto: [
          { id: rojo, producto: 'Morrón', color: 'Rojo', tamano: 'XL', cajas: 10 },
          { id: amarillo, producto: 'Morrón', color: 'Amarillo', tamano: 'LG', cajas: 5 },
        ],
      };
      await aplicarCrearTrailer(tx, trailerId, alta, llegada);
      const t = await tx.trailer.findUnique({
        where: { id: trailerId },
        include: { manifiesto: true },
      });
      comprobar(
        t?.fechaLlegada.getTime() === llegada.getTime(),
        'el trailer guarda la hora de la tablet',
      );
      comprobar(
        t?.manifiesto.some((l) => l.id === rojo) ?? false,
        'las líneas conservan el id de la tablet',
      );
      comprobar(
        t?.flete.toFixed(2) === '0.00' && t?.comisionPorcentaje.toFixed(2) === '10.00',
        'valores por defecto: flete 0 y comisión 10 %',
      );
      await fallaCon('trailer repetido', 'ya está registrado', () =>
        aplicarCrearTrailer(tx, trailerId, alta, llegada),
      );

      // ---------- Ventas ----------
      const { _max } = await tx.ticket.aggregate({ _max: { folio: true } });
      const folio = (_max.folio ?? 0) + 1;
      const ticketId = randomUUID();
      const detalleId = randomUUID();
      await aplicarCrearTicket(tx, {
        id: ticketId,
        folio,
        fecha: llegada,
        clienteNombre: 'PRUEBA',
        lineas: [{ id: detalleId, manifiestoDetalleId: rojo, cajas: 3, precioCaja: 33.33 }],
      });
      const tk = await tx.ticket.findUnique({
        where: { id: ticketId },
        include: { detalles: true },
      });
      comprobar(tk?.folio === folio, `usa el folio de la tablet (${folio})`);
      comprobar(tk?.total.toFixed(2) === '99.99', 'total exacto: 3 × 33.33 = 99.99');
      comprobar(tk?.fecha.getTime() === llegada.getTime(), 'la venta guarda la hora de la tablet');
      comprobar(tk?.detalles[0]?.id === detalleId, 'el detalle conserva el id de la tablet');

      const otraVenta = (cajas: number, f: number, id = randomUUID()) =>
        aplicarCrearTicket(tx, {
          id,
          folio: f,
          fecha: llegada,
          clienteNombre: 'PRUEBA',
          lineas: [{ manifiestoDetalleId: rojo, cajas, precioCaja: 10 }],
        });
      await fallaCon('folio repetido', 'ya lo tiene otro ticket', () => otraVenta(1, folio));
      await fallaCon('ticket repetido', 'ya está registrado', () =>
        otraVenta(1, folio + 1, ticketId),
      );
      await fallaCon('vender de más', 'Solo quedan 7 cajas', () => otraVenta(8, folio + 1));

      // ---------- Correcciones al manifiesto ----------
      await fallaCon('bajar cajas de lo vendido', 'Ya se vendieron 3', () =>
        aplicarActualizarLinea(tx, trailerId, rojo, { cajas: 2 }),
      );
      await aplicarActualizarLinea(tx, trailerId, rojo, { cajas: 12 });
      comprobar(
        (await tx.manifiestoDetalle.findUnique({ where: { id: rojo } }))?.cajas === 12,
        'subir las cajas de una línea',
      );
      await fallaCon('color que no existe', 'no viene en color', () =>
        aplicarActualizarLinea(tx, trailerId, amarillo, { color: 'Morado' }),
      );
      await fallaCon('eliminar línea con ventas', 'ya tiene ventas', () =>
        aplicarEliminarLinea(tx, trailerId, rojo),
      );
      const nueva = randomUUID();
      await aplicarAgregarLinea(tx, trailerId, {
        id: nueva,
        producto: 'Morrón',
        color: 'Verde',
        tamano: 'MD',
        cajas: 4,
      });
      await aplicarEliminarLinea(tx, trailerId, nueva);
      comprobar(
        !(await tx.manifiestoDetalle.findUnique({ where: { id: nueva } })),
        'agregar y eliminar una línea sin ventas',
      );

      // ---------- Cancelación ----------
      await aplicarCancelarTicket(tx, ticketId);
      comprobar(
        (await tx.ticket.findUnique({ where: { id: ticketId } }))?.estado === 'CANCELADO',
        'cancelar el ticket',
      );
      await fallaCon('cancelar dos veces', 'ya estaba cancelado', () =>
        aplicarCancelarTicket(tx, ticketId),
      );
      await aplicarActualizarLinea(tx, trailerId, rojo, { cajas: 1 });
      comprobar(true, 'al cancelar, las cajas vuelven a estar disponibles');

      // ---------- Cierre ----------
      await aplicarCambiarEstado(tx, trailerId, 'CERRADO', cierre);
      comprobar(
        (await tx.trailer.findUnique({ where: { id: trailerId } }))?.fechaCierre?.getTime() ===
          cierre.getTime(),
        'el cierre guarda la hora de la tablet',
      );
      await fallaCon('vender de un trailer cerrado', 'está cerrado', () => otraVenta(1, folio + 1));

      throw new Revertir();
    },
    { timeout: 30_000 },
  );
} catch (e) {
  if (!(e instanceof Revertir) && !(e instanceof Error && e.message === 'revertir')) {
    throw e;
  }
}

console.log(
  fallas
    ? `\n${fallas} comprobación(es) fallaron.`
    : '\nTodo bien. Se revirtió la transacción: no quedó ningún dato de prueba.',
);
process.exitCode = fallas ? 1 : 0;
await prisma.$disconnect();
