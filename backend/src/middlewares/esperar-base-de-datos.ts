import type { RequestHandler } from 'express';
import {
  conexionReciente,
  esErrorDeConexion,
  marcarConexionOk,
  MENSAJE_DESPERTANDO,
} from '../lib/conexion.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from './error-handler.js';

/** Tiempo total que se espera a la base antes de responder 503. */
const PLAZO_MS = 20_000;
/** Pausa entre intentos (el último valor se repite). */
const PAUSAS_MS = [500, 1_000, 2_000, 3_000];
/** Máximo que se espera a un SELECT 1. */
const LIMITE_PING_MS = 5_000;

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ping(): Promise<void> {
  let reloj: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, rechazar) => {
        reloj = setTimeout(
          () =>
            rechazar(
              Object.assign(new Error('ETIMEDOUT: la base no respondió a tiempo'), {
                code: 'ETIMEDOUT',
              }),
            ),
          LIMITE_PING_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(reloj);
  }
}

async function despertar(): Promise<void> {
  const limite = Date.now() + PLAZO_MS;
  for (let intento = 1; ; intento++) {
    try {
      await ping();
      marcarConexionOk();
      if (intento > 1) console.log(`Base de datos lista tras ${intento} intentos`);
      return;
    } catch (e) {
      if (!esErrorDeConexion(e)) throw e;
      const pausa = PAUSAS_MS[Math.min(intento - 1, PAUSAS_MS.length - 1)]!;
      if (Date.now() + pausa >= limite) {
        console.error('La base de datos no respondió a tiempo:', e);
        throw new AppError(503, MENSAJE_DESPERTANDO);
      }
      await esperar(pausa);
    }
  }
}

/** Una sola revisión a la vez: las peticiones que llegan juntas esperan la misma. */
let revisando: Promise<void> | null = null;

/**
 * Antes de atender /api, se asegura de que la base responda (el servicio
 * puede venir de estar dormido). Si hubo contacto hace poco, no hace nada.
 */
export const esperarBaseDeDatos: RequestHandler = async (_req, _res, next) => {
  if (!conexionReciente()) {
    revisando ??= despertar().finally(() => {
      revisando = null;
    });
    await revisando;
  }
  next();
};
