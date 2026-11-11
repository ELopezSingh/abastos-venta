import type { ErrorRequestHandler } from 'express';
import { ZodError, z } from 'zod';
import { esErrorDeConexion, marcarConexionPerdida, MENSAJE_DESPERTANDO } from '../lib/conexion.js';

/** Error de negocio con código HTTP (ej. "no hay cajas suficientes" → 409). */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Segundos que se sugiere esperar antes de reintentar un 503. */
const REINTENTAR_EN = '5';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const { formErrors, fieldErrors } = z.flattenError(err);
    res.status(400).json({
      mensaje: formErrors[0] ?? 'Datos inválidos',
      errores: fieldErrors,
    });
    return;
  }
  if (err instanceof AppError) {
    if (err.status === 503) res.setHeader('Retry-After', REINTENTAR_EN);
    res.status(err.status).json({ mensaje: err.message });
    return;
  }
  // La conexión con la base se cayó a la mitad de la petición.
  if (esErrorDeConexion(err)) {
    marcarConexionPerdida();
    console.error('Se perdió la conexión con la base de datos:', err);
    res.setHeader('Retry-After', REINTENTAR_EN);
    res.status(503).json({ mensaje: MENSAJE_DESPERTANDO });
    return;
  }
  // Errores del lector de JSON de Express (body-parser).
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ mensaje: 'El envío es demasiado grande' });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ mensaje: 'El cuerpo de la petición no es un JSON válido' });
    return;
  }
  console.error(err);
  res.status(500).json({ mensaje: 'Error interno del servidor' });
};
