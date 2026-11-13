# Bitácora del proyecto

Estado actual, decisiones y registro de trabajo de la app de ventas. Complementa al [README](../README.md) (cómo funciona la app y cómo trabajar con ella) y al [CHANGELOG](../CHANGELOG.md) (qué cambió en cada versión).

**Cómo se usa**

- Al terminar una sesión de trabajo, agrega una entrada **arriba** en "Registro" y actualiza "Estado actual" si algo cambió.
- Las decisiones que afectan el diseño van también en la tabla de "Decisiones", con su porqué.
- Al publicar una versión, anótala aquí y en el CHANGELOG.
- Nunca anotes contraseñas, tokens ni cadenas de conexión con credenciales: solo dónde se guardan.

---

## Estado actual

*Actualizado: 13 de noviembre de 2026 (v1.3.0 lista para publicar)*

| | |
|---|---|
| **Producción** | v1.2.0 en Railway (rama `main`), desplegada y verificada el 12 nov 2026, con su tag `v1.2.0` en GitHub. v1.3.0 (paso 3) lista para publicar. |
| **Uso real** | El tío ya captura ventas reales en producción, por ahora desde la web en el iPhone. |
| **Dispositivos** | APK con los cambios del paso 3 probado en un teléfono Android (13 nov). La tablet Samsung del tío y la impresora están pendientes de compra/definición. La web se usa desde el iPhone. |
| **Desarrollo** | PostgreSQL local con pgAdmin 4, con una copia restaurada del respaldo de producción. |
| **Siguiente paso** | Publicar v1.3.0: merge a `develop` y a `main`, verificar en producción y crear el tag. Luego, el paso 4. |
| **Pendiente de git** | Merge de `feature/web-solo-lectura` a `develop` y de `develop` a `main`; tag `v1.3.0` después de verificar. |
| **Para el paso 4** | Una operación rechazada solo sale de la lista si la tablet la reenvía y se aplica. Falta decidir cómo descartar las que no se van a reintentar; como la web es de solo lectura, sería desde la tablet. Cambiar `capturaHabilitada` a `false` en la web cuando el tío tenga la tablet con el APK. |

### Plan: la tablet captura sin conexión

| Paso | Qué incluye | Estado |
|---|---|---|
| 1 | Reglas de negocio en `@abastos/shared` (funciones puras, dinero en centavos, `ErrorDeRegla`, pruebas) | ✅ v1.2.0 |
| 2 | Backend: `POST /api/sync`, `GET /api/sync/snapshot`, rechazos y último contacto, arranque en frío | ✅ v1.2.0 |
| 3 | Web solo lectura, "Última sincronización de la tablet: hace X", vista de rechazos, reintento ante 503 | ✅ v1.3.0 (por publicar). La web sale con la captura habilitada hasta que llegue la tablet. |
| 4 | Tablet: SQLite, cola de operaciones, sincronización, rechazadas, snapshot, aviso de reloj | ⏳ Siguiente |
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
| 2026-11-12 | En el paso 3, el modo solo lectura va solo en el frontend, con `capturaHabilitada` en los environments. Las rutas REST de escritura se apagan en el backend al final del paso 4. | El APK todavía captura con las rutas REST; `/api/sync` lo empieza a usar en el paso 4. |
| 2026-11-12 | En la web, `/vender` y `/trailers/nuevo` se quitan con `canMatch` y caen a Inicio. La lógica de cerrar, reabrir y cancelar se queda en los componentes, solo oculta. | Es el mismo código para web y APK; el APK la sigue usando. |
| 2026-11-12 | El aviso "Última sincronización" no se muestra si la tablet nunca ha sincronizado; se pone amarillo después de 30 min y se revisa cada minuto solo con la app visible. | Hasta el paso 4 el APK no usa `/api/sync`: "nunca sincronizó" haría creer que la web está atrasada. Revisar solo con la app visible evita mantener despierto Railway. |
| 2026-11-12 | `GET /api/sync/rechazadas` devuelve las 100 más recientes y el total; los datos se muestran tal como llegaron. | Los rechazos deben ser pocos; un dato mal formado es justo lo que hay que poder revisar. |
| 2026-11-12 | El reintento ante 503 es solo para consultas (GET) y el login. | Un POST que guarda pudo aplicarse antes de que se cayera la conexión; repetirlo a ciegas podría duplicar un vale. |
| 2026-11-12 | Al arrancar, solo un 401 cierra la sesión. Con usuario guardado la app abre sin esperar `/api/auth/yo`. | Con el servidor dormido, esperar dejaba la pantalla en blanco hasta un minuto y un 503 mandaba al login. |
| 2026-11-13 | Publicar el paso 3 como v1.3.0 con `capturaHabilitada: true` en la web. Se cambia a `false` cuando el tío tenga la tablet con el APK, a más tardar con el paso 4. | El tío captura desde el iPhone y la tablet aún no se compra: con `false` se quedaría sin poder vender. Así entran ya las correcciones del arranque en frío y las pantallas de seguimiento. |

---

## Registro

### 2026-11-13 — APK del paso 3 probado y preparación de v1.3.0

- APK generado en el equipo de casa e instalado en un teléfono Android: probado con los cambios del paso 3.
- `capturaHabilitada: true` temporal en `environment.ts` (web), porque el tío todavía captura desde el iPhone.
- Documentación para v1.3.0: README (estado, API de sync, pantallas y modo solo lectura, autenticación, 503, estructura, pruebas y pendientes), CHANGELOG y esta bitácora.

### 2026-11-12 — Paso 3: web solo lectura (rama `feature/web-solo-lectura`)

- **3a** (backend): `GET /api/sync/estado` y `GET /api/sync/rechazadas`, sin migración. DTOs en `shared/src/sync.ts`. `probar-sync.ts` con 6 comprobaciones nuevas y `sync.http`.
- **3b** (frontend): `capturaHabilitada` en los environments y `core/captura.ts`. Rutas de captura con `canMatch`, pantallas Inicio y Sincronización, aviso de la tablet bajo la barra superior y botones de captura ocultos en la web. Pruebas de `haceCuanto` y `describirOperacion`. Se corrigió `app.spec.ts`, que ya fallaba por `SwUpdate`.
- **3c** (frontend): interceptor `reintento503Interceptor` y `EstadoServidorService` con la barra "El servidor está despertando…". Al probar el arranque en frío se encontraron dos fallas y se corrigieron: un 503 al abrir mandaba al login (`errores-red.ts` usaba `HttpResponse` en lugar de `HttpErrorResponse`) y la app se quedaba en blanco esperando `/api/auth/yo`.
- Validado en local: builds de web y android, `npm test -w shared`, `probar-sync.ts`, pruebas del frontend (18), peticiones de `sync.http` y desde la consola, rechazos y aviso amarillo, y PostgreSQL detenido y reiniciado con la app abierta.
- No se pudo generar el APK: la red de la oficina no deja descargar Gradle. Queda pendiente probarlo en el equipo de casa.

### 2026-11-12 — v1.2.0 en producción y documentación

- Respaldo de producción con pgAdmin antes del despliegue.
- Merge `feature/sync` → `develop` → `main`. El pre-deploy aplicó `20261111222142_sync_rechazos_y_contacto` y la revisión en producción salió bien.
- Documentación: README actualizado a v1.2.0, nuevo CHANGELOG y esta bitácora.
- Tag `v1.2.0` creado sobre `main` y subido a GitHub después de verificar producción.

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
- La web local usa `environment.ts` (`npm run dev`): captura o es de solo lectura según lo que diga ese archivo. Para probar el otro modo, cambiar `capturaHabilitada` temporalmente y regresarlo con `git restore frontend/src/environments/environment.ts` antes del commit.
- Antes de quitar una función en producción, confirmar desde qué dispositivo la usa hoy el tío.
- Los errores de `HttpClient` son `HttpErrorResponse`, no `HttpResponse`: un `instanceof HttpResponse` nunca los detecta.
- Generar el APK por primera vez descarga Gradle (~200 MB); si la red lo bloquea, hacerlo desde otra red.
