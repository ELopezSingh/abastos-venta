import { formatearFolio } from '@abastos/shared';
import { nombreProducto } from '../core/catalogos';

export interface DescripcionOperacion {
  titulo: string;
  /** Datos para reconocerla (folio, cliente, viaje…), o null si no hay nada útil. */
  detalle: string | null;
}

type Objeto = Record<string, unknown>;

// Los datos de un rechazo pueden venir incompletos o mal formados
// (justo por eso se rechazó): se leen con cuidado.
const objeto = (v: unknown): Objeto => (typeof v === 'object' && v !== null ? (v as Objeto) : {});
const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const numero = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const lista = (v: unknown): Objeto[] => (Array.isArray(v) ? v.map(objeto) : []);

function unir(partes: (string | null)[]): string | null {
  const llenas = partes.filter((p): p is string => !!p);
  return llenas.length ? llenas.join(' · ') : null;
}

function cajas(lineas: Objeto[]): string | null {
  const total = lineas.reduce((acc, l) => acc + (numero(l['cajas']) ?? 0), 0);
  return total > 0 ? `${total} ${total === 1 ? 'caja' : 'cajas'}` : null;
}

function linea(l: Objeto): string | null {
  const producto = texto(l['producto']);
  if (!producto) return null;
  return unir([
    `${nombreProducto(producto, texto(l['color']))} ${texto(l['tamano']) ?? ''}`.trim(),
    cajas([l]),
  ]);
}

/** Texto para mostrar una operación de la tablet a una persona. */
export function describirOperacion(tipo: string, datos: unknown): DescripcionOperacion {
  const d = objeto(datos);
  switch (tipo) {
    case 'ticket.crear': {
      const folio = numero(d['folio']);
      return {
        titulo: 'Venta',
        detalle: unir([
          folio !== null ? `Folio ${formatearFolio(folio)}` : null,
          texto(d['clienteNombre']),
          cajas(lista(d['lineas'])),
        ]),
      };
    }
    case 'ticket.cancelar':
      return { titulo: 'Cancelación de vale', detalle: null };
    case 'trailer.crear': {
      const numeroTrailer = texto(d['numero']);
      return {
        titulo: 'Registro de trailer',
        detalle: unir([
          texto(d['viaje']),
          numeroTrailer ? `Trailer ${numeroTrailer}` : null,
          texto(d['invernadero']),
          cajas(lista(d['manifiesto'])),
        ]),
      };
    }
    case 'trailer.actualizar':
      return { titulo: 'Corrección de datos del trailer', detalle: null };
    case 'trailer.cambiarEstado': {
      const estado = d['estado'];
      const titulo =
        estado === 'CERRADO'
          ? 'Cierre de trailer'
          : estado === 'ACTIVO'
            ? 'Reapertura de trailer'
            : 'Cambio de estado del trailer';
      return { titulo, detalle: null };
    }
    case 'linea.agregar':
      return { titulo: 'Línea agregada al manifiesto', detalle: linea(objeto(d['linea'])) };
    case 'linea.actualizar': {
      const nuevas = numero(objeto(d['cambios'])['cajas']);
      return {
        titulo: 'Corrección del manifiesto',
        detalle: nuevas !== null ? `Cajas: ${nuevas}` : null,
      };
    }
    case 'linea.eliminar':
      return { titulo: 'Línea eliminada del manifiesto', detalle: null };
    default:
      return { titulo: `Operación desconocida (${tipo})`, detalle: null };
  }
}
