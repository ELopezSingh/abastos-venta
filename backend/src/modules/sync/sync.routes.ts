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

/** Para la web: último contacto de la tablet y número de rechazos. */
syncRouter.get('/estado', async (_req, res) => {
  res.json(await servicio.estadoSync());
});

/** Para la web: operaciones rechazadas con su motivo. */
syncRouter.get('/rechazadas', async (_req, res) => {
  res.json(await servicio.listarRechazadas());
});
