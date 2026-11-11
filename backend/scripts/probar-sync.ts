/**
 * Prueba la sincronización y el snapshot contra la base LOCAL.
 * Crea datos de prueba con ids propios y al final los borra.
 *
 * Uso (desde backend/): npx tsx scripts/probar-sync.ts
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import { sincronizar, snapshot } from '../src/modules/sync/sync.service.js';

let fallas = 0;
function comprobar(ok: boolean, texto: string) {
  console.log(`${ok ? '✓' : '✗'} ${texto}`);
  if (!ok) fallas++;
}

// Como si la tablet lo hubiera hecho sin señal.
const manana = '2026-11-10T07:15:00-06:00';
const tarde = '2026-11-10T18:00:00-06:00';

const trailerId = randomUUID();
const rojo = randomUUID();
const ticketId = randomUUID();
const opIds: string[] = [];
const op = (tipo: string, datos: unknown, creadaEn = manana) => {
  const id = randomUUID();
  opIds.push(id);
  return { id, tipo, creadaEn, datos };
};
const venta = (id: string, folio: number, cajas: number, precioCaja = 10) => ({
  id,
  folio,
  clienteNombre: 'PRUEBA',
  lineas: [{ id: randomUUID(), manifiestoDetalleId: rojo, cajas, precioCaja }],
});

const contactoAntes = await prisma.estadoSync.findUnique({ where: { id: 1 } });
const { _max } = await prisma.ticket.aggregate({ _max: { folio: true } });
const folio = (_max.folio ?? 0) + 1;

try {
  // 1. Alta de trailer y venta en el mismo lote.
  const alta = op('trailer.crear', {
    id: trailerId,
    viaje: 'PRUEBA-SYNC',
    placa: 'PRUEBA',
    numero: 'PRUEBA-S',
    invernadero: 'Prueba',
    chofer: 'Prueba',
    anden: '0',
    costoAnden: 350,
    manifiesto: [{ id: rojo, producto: 'Morrón', color: 'Rojo', tamano: 'XL', cajas: 10 }],
  });
  const primera = op('ticket.crear', venta(ticketId, folio, 3, 33.33));
  let r = await sincronizar({ operaciones: [alta, primera] });
  comprobar(
    r.resultados.every((x) => x.estado === 'APLICADA'),
    'aplica el alta del trailer y la venta',
  );
  const tk = await prisma.ticket.findUnique({ where: { id: ticketId } });
  comprobar(
    tk?.folio === folio && tk.fecha.getTime() === new Date(manana).getTime(),
    `la venta conserva el folio (${folio}) y la hora de la tablet`,
  );
  comprobar(tk?.total.toFixed(2) === '99.99', 'total exacto: 99.99');

  // 2. Reenvío del mismo lote (la tablet no recibió la respuesta).
  r = await sincronizar({ operaciones: [alta, primera] });
  comprobar(
    r.resultados.every((x) => x.estado === 'YA_APLICADA'),
    'un reenvío no aplica nada dos veces',
  );
  comprobar(
    (await prisma.ticket.count({ where: { folio } })) === 1,
    'sigue habiendo un solo ticket con ese folio',
  );

  // 3. Rechazos sin detener el lote.
  const folioRepetido = op('ticket.crear', venta(randomUUID(), folio, 1));
  const deMas = op('ticket.crear', venta(randomUUID(), folio + 1, 8));
  const desconocida = op('ticket.borrar', { ticketId });
  const malFormada = { tipo: 'ticket.cancelar', datos: { ticketId } }; // sin id ni hora
  const correccion = op('linea.actualizar', { trailerId, lineaId: rojo, cambios: { cajas: 12 } });
  r = await sincronizar({
    operaciones: [folioRepetido, deMas, desconocida, malFormada, correccion],
  });
  const [a, b, c, d, e] = r.resultados;
  comprobar(
    a?.estado === 'RECHAZADA' && !!a.motivo?.includes('ya lo tiene otro ticket'),
    `folio repetido → "${a?.motivo}"`,
  );
  comprobar(
    b?.estado === 'RECHAZADA' && !!b.motivo?.includes('Solo quedan 7'),
    `sin existencias → "${b?.motivo}"`,
  );
  comprobar(
    c?.estado === 'RECHAZADA' && !!c.motivo?.includes('desconocido'),
    `tipo desconocido → "${c?.motivo}"`,
  );
  comprobar(d?.estado === 'RECHAZADA' && d.id === null, `mal formada → "${d?.motivo}"`);
  comprobar(e?.estado === 'APLICADA', 'sigue con las demás después de un rechazo');
  comprobar(
    (await prisma.operacionRechazada.count({ where: { id: { in: opIds } } })) === 3,
    'guarda en el servidor los 3 rechazos que traen id',
  );

  // 4. Un rechazo reenviado suma intentos.
  await sincronizar({ operaciones: [folioRepetido] });
  const rechazo = await prisma.operacionRechazada.findUnique({ where: { id: folioRepetido.id } });
  comprobar(rechazo?.intentos === 2, 'un rechazo reenviado suma intentos');

  // 5. Snapshot.
  const s = await snapshot();
  comprobar(
    s.trailers.some((t) => t.id === trailerId),
    'el snapshot trae el trailer activo',
  );
  comprobar(
    s.tickets.some((t) => t.id === ticketId),
    'el snapshot trae sus tickets',
  );
  comprobar(s.ultimoFolio === folio, `el snapshot trae el último folio (${s.ultimoFolio})`);

  // 6. Cancelar y cerrar con la hora de la tablet.
  r = await sincronizar({
    operaciones: [
      op('ticket.cancelar', { ticketId }),
      op('trailer.cambiarEstado', { trailerId, estado: 'CERRADO' }, tarde),
    ],
  });
  comprobar(
    r.resultados.every((x) => x.estado === 'APLICADA'),
    'cancela el ticket y cierra el trailer',
  );
  const t = await prisma.trailer.findUnique({ where: { id: trailerId } });
  comprobar(
    t?.fechaCierre?.getTime() === new Date(tarde).getTime(),
    'el cierre guarda la hora de la tablet',
  );
  const s2 = await snapshot();
  comprobar(
    !s2.trailers.some((x) => x.id === trailerId),
    'un trailer cerrado ya no viene en el snapshot',
  );

  // 7. Un lote vacío registra el contacto.
  const antes = Date.now();
  await sincronizar({ operaciones: [] });
  const contacto = await prisma.estadoSync.findUnique({ where: { id: 1 } });
  comprobar(
    (contacto?.ultimoContacto.getTime() ?? 0) >= antes - 1000,
    'un lote vacío registra el contacto',
  );

  // 8. Más de 100 operaciones.
  try {
    await sincronizar({ operaciones: new Array(101).fill({}) });
    comprobar(false, 'rechaza lotes de más de 100 operaciones');
  } catch {
    comprobar(true, 'rechaza lotes de más de 100 operaciones');
  }
} finally {
  // ---------- Limpieza ----------
  await prisma.ticket.deleteMany({
    where: { detalles: { some: { manifiestoDetalleId: rojo } } },
  });
  await prisma.trailer.deleteMany({ where: { id: trailerId } }); // borra su manifiesto en cascada
  await prisma.operacionSync.deleteMany({ where: { id: { in: opIds } } });
  await prisma.operacionRechazada.deleteMany({ where: { id: { in: opIds } } });
  if (contactoAntes) {
    await prisma.estadoSync.update({
      where: { id: 1 },
      data: { ultimoContacto: contactoAntes.ultimoContacto },
    });
  } else {
    await prisma.estadoSync.deleteMany({ where: { id: 1 } });
  }
  console.log(
    fallas
      ? `\n${fallas} comprobación(es) fallaron. Los datos de prueba se borraron.`
      : '\nTodo bien. Los datos de prueba se borraron.',
  );
  process.exitCode = fallas ? 1 : 0;
  await prisma.$disconnect();
}
