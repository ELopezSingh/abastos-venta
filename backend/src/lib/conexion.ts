/**
 * Detección de errores de conexión con la base y estado de la conexión.
 * En Railway el servicio duerme; al despertar, las primeras consultas pueden
 * fallar con ETIMEDOUT mientras la red privada hacia Postgres se levanta.
 */

export const MENSAJE_DESPERTANDO =
  'El servidor está despertando. Intenta de nuevo en unos segundos.';

/** Códigos de Prisma, de Node y de Postgres que indican problema de conexión. */
const CODIGOS = new Set([
  'P1001', // no se alcanza la base
  'P1002', // la base no respondió a tiempo
  'P1008', // la operación tardó demasiado
  'P1017', // el servidor cerró la conexión
  'P2024', // no hubo conexión libre a tiempo
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'EHOSTUNREACH',
  'ENETUNREACH',
  '57P01', // Postgres: apagado por el administrador
  '57P03', // Postgres: todavía no acepta conexiones
]);

/** Frases que aparecen en el mensaje cuando el código no viene. */
const FRASES = [
  'etimedout',
  'econnrefused',
  'econnreset',
  "can't reach database",
  'connection terminated',
  'timeout exceeded when trying to connect',
  'server closed the connection',
  'databasenotreachable',
];

/** Revisa el error y sus causas (Prisma envuelve el error original del driver). */
export function esErrorDeConexion(error: unknown): boolean {
  let actual: unknown = error;
  for (let nivel = 0; nivel < 5 && actual && typeof actual === 'object'; nivel++) {
    const { code, message, kind, cause } = actual as {
      code?: unknown;
      message?: unknown;
      kind?: unknown;
      cause?: unknown;
    };
    if (typeof code === 'string' && CODIGOS.has(code)) return true;
    const texto = [message, kind]
      .filter((v): v is string => typeof v === 'string')
      .join(' ')
      .toLowerCase();
    if (FRASES.some((f) => texto.includes(f))) return true;
    actual = cause;
  }
  return false;
}

// ---------- Estado de la conexión ----------

/** Si hubo contacto con la base hace menos de esto, no se vuelve a revisar. */
const VIGENCIA_MS = 60_000;
let ultimaConexionOk = 0;

export const conexionReciente = () => Date.now() - ultimaConexionOk < VIGENCIA_MS;
export const marcarConexionOk = () => {
  ultimaConexionOk = Date.now();
};
/** Tras un error de conexión: la siguiente petición vuelve a revisar la base. */
export const marcarConexionPerdida = () => {
  ultimaConexionOk = 0;
};
