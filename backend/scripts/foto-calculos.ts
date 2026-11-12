/**
 * Guarda en un JSON los cálculos del backend sobre la base actual:
 * resumen y tickets de cada día con movimiento, liquidación de cada trailer
 * y la lista de trailers. Sirve para comparar dos versiones del código.
 *
 * Uso (desde backend/): npx tsx scripts/foto-calculos.ts <archivo.json>
 */
import { writeFile } from 'node:fs/promises';
import { prisma } from '../src/lib/prisma.js';
import { liquidacionTrailer, resumenDelDia } from '../src/modules/resumen/resumen.service.js';
import { listarTickets } from '../src/modules/tickets/tickets.service.js';
import { listarTrailers } from '../src/modules/trailers/trailers.service.js';

const salida = process.argv[2];
if (!salida) {
  console.error('Uso: npx tsx scripts/foto-calculos.ts <archivo.json>');
  process.exit(1);
}

const diaCdmx = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Mexico_City',
});

const [tickets, trailers] = await Promise.all([
  prisma.ticket.findMany({ select: { fecha: true } }),
  prisma.trailer.findMany({
    select: { id: true, fechaLlegada: true },
    orderBy: { id: 'asc' },
  }),
]);

const dias = [
  ...new Set(
    [...tickets.map((t) => t.fecha), ...trailers.map((t) => t.fechaLlegada)].map((f) =>
      diaCdmx.format(f),
    ),
  ),
].sort();

const resumenes: Record<string, unknown> = {};
const ticketsPorDia: Record<string, unknown> = {};
for (const dia of dias) {
  resumenes[dia] = await resumenDelDia(dia);
  ticketsPorDia[dia] = await listarTickets(dia);
}

const liquidaciones: Record<string, unknown> = {};
for (const t of trailers) {
  liquidaciones[t.id] = await liquidacionTrailer(t.id);
}

// Ordenado por id para que los empates de fecha no cambien el orden entre corridas.
const listaTrailers = (await listarTrailers()).sort((a, b) => a.id.localeCompare(b.id));

await writeFile(
  salida,
  JSON.stringify(
    { resumenes, tickets: ticketsPorDia, liquidaciones, trailers: listaTrailers },
    null,
    2,
  ),
);
console.log(
  `Listo: ${dias.length} días, ${tickets.length} tickets, ${trailers.length} trailers → ${salida}`,
);
await prisma.$disconnect();
