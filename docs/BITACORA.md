# Bitácora del proyecto

Estado actual, decisiones y registro de trabajo de la app de ventas. Complementa al [README](../README.md) (cómo funciona la app y cómo trabajar con ella) y al [CHANGELOG](../CHANGELOG.md) (qué cambió en cada versión).

**Cómo se usa**

- Al terminar una sesión de trabajo, agrega una entrada **arriba** en "Registro" y actualiza "Estado actual" si algo cambió.
- Las decisiones que afectan el diseño van también en la tabla de "Decisiones", con su porqué.
- Al publicar una versión, anótala aquí y en el CHANGELOG.
- Nunca anotes contraseñas, tokens ni cadenas de conexión con credenciales: solo dónde se guardan.

---

## Estado actual

*Actualizado: 12 de noviembre de 2026*

| | |
|---|---|
| **Producción** | v1.2.0 en Railway (rama `main`), desplegada el 12 nov 2026. |
| **Uso real** | El tío ya captura ventas reales en producción. |
| **Dispositivos** | APK probado en un dispositivo Android (login contra Railway). La tablet Samsung del tío y la impresora están pendientes de compra/definición. La web se usa desde el iPhone. |
| **Desarrollo** | PostgreSQL local con pgAdmin 4, con una copia restaurada del respaldo de producción. |
| **Siguiente paso** | Paso 3 del plan sin conexión: web en modo solo lectura (nueva rama desde `develop`). |
| **Pendiente de git** | Crear el tag `v1.2.0` sobre `main` cuando se confirme la revisión en producción. |

### Plan: la tablet captura sin conexión

| Paso | Qué incluye | Estado |
|---|---|---|
| 1 | Reglas de negocio en `@abastos/shared` (funciones puras, dinero en centavos, `ErrorDeRegla`, pruebas) | ✅ v1.2.0 |
| 2 | Backend: `POST /api/sync`, `GET /api/sync/snapshot`, rechazos y último contacto, arranque en frío | ✅ v1.2.0 |
| 3 | Web solo lectura, "Última sincronización de la tablet: hace X", vista de rechazos, reintento ante 503 | ⏳ Siguiente |
| 4 | Tablet: SQLite, cola de operaciones, sincronización, rechazadas, snapshot, aviso de reloj | Pendiente |
| — | Impresora térmica (hardware sin definir) | Después |

---

## Decisiones

| Fecha | Decisión | Por qué |
|---|---|---|
| 2026-10-22 | Todo en TypeScript, monorepo con npm workspaces (`shared`, `backend`, `frontend`). | Un solo lenguaje; esquemas y tipos compartidos entre back y front. |
| 2026-10-23 | Ganancia neta = ventas − costos de andén (provisional). | Definición acordada por ahora; se puede cambiar después. |
| 2026-10-27 | Sin conexión en la web solo niveles 1 y 2, con el service worker de Angular (sin IndexedDB). Guardar requiere conexión. | El tío usa un solo dispositivo a la vez; era lo mínimo útil antes del deploy. |
| 2026-10-28 | Login de un solo usuario, sesión por cookie en tabla, argon2, usuario creado por comando. | No había autenticación; es lo más simple y seguro para un solo usuario. |
| 2026-10-28 | Todo en Railway: Express sirve el build de Angular y la base es PostgreSQL de Railway. | Mismo origen (sin CORS, cookie *first-party*) y un solo lugar que administrar. |
| 2026-11 | Tablet Samsung (Android) con APK de Capacitor en lugar de iPad. | Compatibilidad y licencias (sin cuota anual de Apple). |
| 2026-11 | Offline-first con sincronización por operaciones: la tablet guarda local y sincroniza al haber señal. | El tío trabaja con datos móviles y la señal en el andén falla. |
| 2026-11 | La tablet es el único dispositivo que captura; la web queda solo de lectura para consultar desde el iPhone. | Evita conflictos entre dos dispositivos que capturan. |
| 2026-11-04 | Ids UUID y folio de vale aparte; los vales viejos conservan su número. | La tablet debe poder crear registros sin conexión. |
| 2026-11 | `main` = producción; trabajo en `develop` y `feature/*`. Toda migración conserva datos, se prueba con una copia restaurada y se despliega con respaldo previo, en un horario sin ventas. | El tío ya captura ventas reales. |
| 2026-11-10 | Dinero en `shared` como centavos enteros; Postgres sigue en `Decimal`. | `shared` no puede depender de Prisma; los centavos son exactos y sirven para SQLite. |
| 2026-11-10 | Las reglas lanzan `ErrorDeRegla` y el backend lo traduce con `conReglas()`. | El mismo error sirve en el backend (HTTP) y en la tablet (operación rechazada). |
| 2026-11 | El folio lo asigna la tablet. | Debe imprimirse al momento, aunque no haya señal. |
| 2026-11-10 | Sync: cada operación en su transacción; si una se rechaza, se sigue con las demás. | Un error no debe detener la subida de las ventas del día. |
| 2026-11-10 | Ventas, llegadas y cierres guardan la hora de la tablet. | Una venta sin señal cuenta para el día y la hora en que se hizo. `aplicadaEn` guarda la del servidor. |
| 2026-11-10 | Snapshot: trailers activos, todos sus vales y el último folio. | Lo necesario para vender, cancelar y liquidar; los cerrados se consultan en línea. |
| 2026-11-10 | Los rechazos también se guardan en el servidor (`operaciones_rechazadas`). | Para revisarlos a distancia sin pedirle fotos de la tablet al tío. |
| 2026-11-10 | "Última sincronización" = último contacto de la tablet, aunque no traiga operaciones (`estado_sync`). | Si dice "hace 2 min", la web está al día aunque no haya ventas nuevas. |
| 2026-11-10 | Arranque en frío: el backend espera a la base y responde 503 con mensaje; no se reintenta dentro de transacciones. | Repetir una consulta dentro de una transacción rota no sirve; `/api/sync` es idempotente y la tablet puede reintentar el lote. |
| 2026-11-11 | Desplegar el paso 2 antes del paso 3. No cambiar la rama de producción para probar; el tag se crea después de verificar en producción. | La migración solo agrega tablas y el arreglo del arranque en frío ayuda desde ya. El rollback se hace desde Railway. |

---

## Registro

### 2026-11-12 — v1.2.0 en producción y documentación

- Respaldo de producción con pgAdmin antes del despliegue.
- Merge `feature/sync` → `develop` → `main`. El pre-deploy aplicó `20261111222142_sync_rechazos_y_contacto` y la revisión en producción salió bien.
- Documentación: README actualizado a v1.2.0, nuevo CHANGELOG y esta bitácora.

### 2026-11-11 — Paso 2: sincronización en el backend

- **2a**: esquemas de las 8 operaciones (`shared/src/operaciones.ts`) y servicios separados en funciones `aplicar…(tx, …)`. Correcciones al manifiesto y cancelaciones con bloqueo de fila. `probar-escrituras.ts` (revierte todo). Validado con la foto antes/después.
- **2b**: migración de `operaciones_rechazadas` y `estado_sync`, `POST /api/sync`, `GET /api/sync/snapshot`, límite de 1 MB y respuestas 413/400. `probar-sync.ts`.
- **2c**: arranque en frío (`esperarBaseDeDatos`, `lib/conexion.ts`, 503 con `Retry-After`, `connectionTimeoutMillis` de 5 s). Probado deteniendo el servicio de PostgreSQL local.
- Incidente: al reemplazar `listarTickets` se borró `crearTicket`; lo detectó `npm run build -w backend`. Lección: revisar `git diff` después de editar por partes.
- Prueba manual completa desde la app y desde la consola del navegador (ver README, sección 13).

### 2026-11-10 — Paso 1: reglas de negocio en shared

- Reglas en `shared/src/reglas/`, dinero en centavos (`shared/src/dinero.ts`), `ErrorDeRegla` y `conReglas()`.
- El redondeo de la comisión se comparó contra decimal.js (la base de `Prisma.Decimal`) en 200 000 casos, sin diferencias.
- Pruebas con Vitest y `foto-calculos.ts`; la foto antes/después contra datos reales salió idéntica.

### 2026-11-04 — v1.1.0: UUID, folio y APK

- APK de Android con Capacitor, instalado en un dispositivo y con login contra Railway. El primer intento podía fallar mientras el servicio despertaba (resuelto en v1.2.0).
- Migración a UUID con folio, escrita a mano para conservar los datos, probada con una copia de producción.
- El repo se transfirió a la cuenta personal de GitHub y Railway quedó conectado directo al repo.

### 2026-10-29 — v1.0.0: primera versión en producción

- Deploy en Railway (cuenta antigua, plan Free): migraciones aplicadas, usuario creado y login funcionando.
- El tío probó la app y funcionó bien. Decidió usar una tablet Samsung (Android) en lugar de iOS.

### 2026-10-22 al 2026-10-28 — Construcción de la primera versión

- Módulos de trailers, vales y resumen en el backend; pantallas de registrar trailer, vender, vales, resumen, liquidación y trailers cerrados.
- PWA con niveles 1 y 2 sin conexión.
- Login y preparación del deploy (Express sirve Angular).

---

## Lecciones aprendidas

- Al cambiar `shared`: `npm run build:shared` y, si el frontend no toma el cambio, borrar `frontend/.angular/cache`.
- `npm run dev` no revisa tipos del backend: validar con `npm run build -w backend` antes de cada commit.
- Prisma 7 no regenera el cliente al migrar: `npm run db:generate -w backend`.
- Las migraciones con datos se escriben o ajustan a mano, se prueban con una copia restaurada de producción y se despliegan con respaldo previo, en un horario sin ventas.
- Para refactors sin cambios visibles: foto antes/después con `foto-calculos.ts`, sacando los cambios con `git stash push --include-untracked`.
- Al editar un archivo por partes, revisar `git diff` antes del commit.
- En producción no se venden vales de prueba: un folio usado no se recupera.
- El tag de una versión se crea después de verificarla en producción.
- No escribir datos sensibles en código, documentos, commits ni chats.
