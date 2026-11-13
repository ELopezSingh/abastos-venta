import { z } from 'zod';
import { es } from 'zod/locales';

// Mensajes de validación de Zod en español (aplica en backend y frontend).
z.config(es());

export * from './comun.js';
export * from './dinero.js';
export * from './trailer.js';
export * from './ticket.js';
export * from './resumen.js';
export * from './catalogos.js';
export * from './auth.js';
export * from './errores.js';
export * from './reglas/index.js';
export * from './operaciones.js';
export * from './sync.js';
export * from './fechas.js';
