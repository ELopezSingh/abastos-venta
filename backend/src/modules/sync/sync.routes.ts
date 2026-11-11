import { Router } from 'express';
import * as servicio from './sync.service.js';

export const syncRouter = Router();

/** La tablet manda su cola de operaciones (máximo 100 por envío). */
syncRouter.post('/', async (req, res) => {
  res.json(await servicio.sincronizar(req.body));
});

/** Carga inicial de la tablet (instalación o reinstalación). */
syncRouter.get('/snapshot', async (_req, res) => {
  res.json(await servicio.snapshot());
});
