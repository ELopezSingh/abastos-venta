import { existsSync } from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { trailersRouter } from "./modules/trailers/trailers.routes.js";
import { ticketsRouter } from "./modules/tickets/tickets.routes.js";
import { resumenRouter } from "./modules/resumen/resumen.routes.js";
import cookieParser from "cookie-parser";
import { authRouter } from "./modules/auth/auth.routes.js";
import { requiereSesion } from "./middlewares/requiere-sesion.js";
import { syncRouter } from './modules/sync/sync.routes.js';
import { esperarBaseDeDatos } from "./middlewares/esperar-base-de-datos.js";

export const app = express();

app.set("trust proxy", 1);

app.use(cors({ origin: env.CORS_ORIGIN, exposedHeaders: ["Date"] }));
// /api/sync recibe lotes de operaciones: necesita un límite mayor que el
// resto (100 kb por defecto). Va antes del general; el segundo ve que el
// cuerpo ya se leyó y no lo vuelve a procesar.
app.use("/api/sync", express.json({ limit: "1mb" }));
app.use(express.json());
app.use(cookieParser());

// Antes de cualquier ruta /api (también auth, que consulta la base):
// si el servidor acaba de despertar, espera a que la base responda.
app.use("/api", esperarBaseDeDatos);

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);

app.use("/api", requiereSesion);

app.use("/api/trailers", trailersRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/resumen", resumenRouter);
app.use('/api/sync', syncRouter);

// ---- Frontend (solo si existe el build: en `npm run dev` no hace nada) ----
const dirFrontend = path.resolve(
  import.meta.dirname,
  "../../frontend/dist/frontend/browser",
);

if (existsSync(dirFrontend)) {
  // Estos archivos siempre se revalidan; si se cachean, el service worker no detecta versiones nuevas
  const sinCache = new Set([
    "index.html",
    "ngsw-worker.js",
    "ngsw.json",
    "safety-worker.js",
    "worker-basic.min.js",
    "manifest.webmanifest",
  ]);

  app.use(
    express.static(dirFrontend, {
      index: false, // "/" lo responde el fallback de abajo, con no-cache
      setHeaders(res, ruta) {
        const archivo = path.basename(ruta);
        if (sinCache.has(archivo)) {
          res.setHeader("Cache-Control", "no-cache");
        } else if (/-[A-Z0-9]{8,}\.(js|css)$/.test(archivo)) {
          // main-ABC123XY.js: el nombre cambia en cada build, se puede cachear para siempre
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );

  // Fallback de SPA: cualquier GET que no sea /api ni un archivo responde index.html
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api") || path.extname(req.path)) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(dirFrontend, "index.html"));
  });
}

app.use(errorHandler);
