# Bitácora del proyecto

Estado actual, decisiones y registro de trabajo de la app de ventas. Complementa al [README](../README.md) (cómo funciona la app y cómo trabajar con ella) y al [CHANGELOG](../CHANGELOG.md) (qué cambió en cada versión).

**Cómo se usa**

- Al terminar una sesión de trabajo, agrega una entrada **arriba** en "Registro" y actualiza "Estado actual" si algo cambió.
- Las decisiones que afectan el diseño van también en la tabla de "Decisiones", con su porqué.
- Al publicar una versión, anótala aquí y en el CHANGELOG.
- Nunca anotes contraseñas, tokens ni cadenas de conexión con credenciales: solo dónde se guardan.

---

## Estado actual

*Actualizado: 17 de noviembre de 2026 (paso 4: 4a.1 y 4a.2 terminadas)*

| | |
|---|---|
| **Producción** | v1.3.0 en Railway (rama `main`), desplegada y verificada el 13 nov 2026, con su tag `v1.3.0` en GitHub. La web sigue capturando (`capturaHabilitada: true`) hasta que el tío tenga la tablet. |
| **Uso real** | El tío ya captura ventas reales en producción, por ahora desde la web en el iPhone. |
| **Dispositivos** | APK con los cambios del paso 3 probado en un teléfono Android (13 nov). La tablet Samsung del tío y la impresora están pendientes de compra/definición. La web se usa desde el iPhone. |
| **Desarrollo** | PostgreSQL local con pgAdmin 4, con una copia restaurada del respaldo de producción. |
| **Siguiente paso** | 4a.3: carga inicial con el snapshot y estado en Ajustes. Después, 4a.4 (`versionCode` y APK firmado en casa). |
| **Pendiente de git** | El paso 4 se trabaja en `feature/tablet-sin-conexion` (desde `develop`). |
| **Para el paso 4** | Partes: 4a SQLite, snapshot y firma (4a.1 ✅, 4a.2 ✅, 4a.3, 4a.4) · 4b lectura local · 4c escritura local y cola · 4d envío de la cola, reloj y sesión · 4e rechazadas (reintentar, descartar, reconstruir) · 4f apagar REST de escritura, `capturaHabilitada: false` en la web y publicar. |

### Plan: la tablet captura sin conexión

| Paso | Qué incluye | Estado |
|---|---|---|
| 1 | Reglas de negocio en `@abastos/shared` (funciones puras, dinero en centavos, `ErrorDeRegla`, pruebas) | ✅ v1.2.0 |
| 2 | Backend: `POST /api/sync`, `GET /api/sync/snapshot`, rechazos y último contacto, arranque en frío | ✅ v1.2.0 |
| 3 | Web solo lectura, "Última sincronización de la tablet: hace X", vista de rechazos, reintento ante 503 | ✅ v1.3.0. La web sale con la captura habilitada hasta que llegue la tablet. |
| 4 | Tablet: SQLite, cola de operaciones, sincronización, rechazadas, snapshot, aviso de reloj | 🔧 En curso (`feature/tablet-sin-conexion`) |
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
| 2026-11-13 | Paso 4: una rechazada se puede **Reintentar** o **Descartar**. Descartar es una operación nueva (`operacion.descartar`) que viaja por la cola de `/api/sync`; después la tablet reconstruye su base con el snapshot y reaplica la cola pendiente. Corregir = descartar y volver a hacer la acción. | La tablet aplica cada operación local antes de mandarla: descartar también debe deshacer su efecto. Por la cola funciona sin señal, respeta el orden y queda auditado; reconstruir sirve igual para los 8 tipos. |
| 2026-11-13 | Staging: ambiente aparte en el mismo proyecto de Railway (o un proyecto aparte si el plan no lo permite), con su propia base restaurada de producción. APK de staging con otro `appId` (`com.chiles.ventas.staging`). | El APK de producción no se usa para pruebas (un folio usado no se recupera). Con otro `appId` las dos apps conviven y no se mezclan datos. |
| 2026-11-13 | El paso 4 se divide en 4a–4f y se publica como una sola versión al final. | Un APK que guarda local pero aún no sincroniza perdería ventas; las partes se validan en local o en staging. |
| 2026-11-13 | La lógica de la tablet se prueba también en el navegador con la implementación web del plugin (`jeep-sqlite`), detrás de un servicio propio. El APK se genera en casa para validar cada parte. | La red de la oficina no deja descargar Gradle. |
| 2026-11-13 | APK firmado con una llave de release (fuera del repo, con respaldo; su contraseña en el gestor) y `versionCode` que sube en cada versión. Ajustes muestra las operaciones pendientes y advierte antes de cerrar sesión o reinstalar. | Con otra llave Android obliga a desinstalar, y desinstalar borra la cola sin subir. |
| 2026-11-13 | La tablet lee de su base lo de operación (Vender, Trailers activos, Vales y Resumen de hoy, Liquidación de activos y lo que cerró la tablet). Los cerrados antiguos y los días anteriores a la instalación se consultan en línea. La base local no se purga. | El snapshot solo trae los trailers activos; el volumen es pequeño y la tablet acumula su propio historial. |
| 2026-11-13 | Reabrir un trailer que está en la base local funciona sin señal. Si no está, requiere conexión: la tablet lo baja (`GET /api/sync/trailers/:id`), lo guarda y encola la operación. `trailer.actualizar` y `linea.*` se soportan en la cola, pero sin pantallas nuevas. | Los cerrados antes de instalar la tablet no vienen en el snapshot. |
| 2026-11-13 | Reloj: la tablet compara su hora con el header `Date` de cada respuesta; aviso amarillo si difiere más de 5 min y rojo si pasa de 1 h. No bloquea las ventas. | Las ventas guardan la hora de la tablet; un reloj mal puesto las mandaría a otro día, pero detener la venta en el andén sería peor. |
| 2026-11-13 | Sesión: un 401 pausa la cola, pide login y la retoma; nunca borra datos locales. Antes se corrige `authInterceptor`, cuya excepción de `/api/auth` nunca aplica. | La sesión puede vencer sin señal; las ventas pendientes no se pueden perder. |
| 2026-11-13 | Las partes 4a–4e se validan en local y staging; se publica todo como v1.4.0 (con 4f) cuando el tío tenga la tablet. Sin backend local por Wi-Fi por ahora. | Apagar las rutas REST y la captura en la web solo tiene sentido con la tablet en uso; publicar antes el backend no aporta. |
| 2026-11-13 | El APK se firma con el asistente de Android Studio ("Generate Signed APK"), sin configurar la firma en Gradle. La variante de staging (otro `appId`) pasa a la 4d. | Así las contraseñas de la llave nunca quedan en un archivo; staging no tiene contra qué probarse antes de la 4d. |
| 2026-11-13 | Bandera `baseLocal` en los environments, aparte de `capturaHabilitada`: `true` en `android` y `tablet-dev`, `false` en la web. | Hoy la web también captura (directo en el servidor); solo la tablet usa SQLite. |
| 2026-11-13 | El plugin entra solo en `android` y `tablet-dev`: `abrir-sqlite.ts` es una versión vacía que esas configuraciones reemplazan por `abrir-sqlite.capacitor.ts` (`fileReplacements`). | Para que el plugin y `jeep-sqlite` no entren al build de la web ni los descargue el service worker del iPhone. |
| 2026-11-13 | Esquema local: dinero en centavos, comisión en centésimas (10 % = 1000), fechas ISO UTC como texto, versión en `PRAGMA user_version`. `ticket_detalle` guarda trailer, producto, color y tamaño, sin llave foránea al manifiesto. La `cola` llega como migración v2 en la 4c. | El snapshot puede traer un vale con una línea de un trailer cerrado que no está en la tablet; así cada vale se muestra solo. La v2 prueba las migraciones sobre una base con datos. |
| 2026-11-17 | `jeep-sqlite` 2.8.0 y `sql.js` 1.12.0 fijados en versión exacta; `copiar-wasm.mjs` revisa que coincidan. | `jeep-sqlite` trae adentro el JavaScript de sql.js 1.11/1.12; el `.wasm` de otra versión (npm había instalado 1.16.0) falla con `LinkError`. |

---

## Registro

### 2026-11-13 al 2026-11-17 — Paso 4: 4a.1 y 4a.2 (rama `feature/tablet-sin-conexion`)

- **4a.1**: `hoyCdmx`, `fechaCdmx`, `rangoDelDia` y `sumarDias` pasan a `shared/src/fechas.ts` (con pruebas); `backend/src/lib/fechas.ts` y `frontend/src/app/core/fechas.ts` solo los reexportan. Bandera `baseLocal`, `environment.tablet-dev.ts`, configuración `tablet-dev` en `angular.json`, `npm run dev:tablet` y `scripts/copiar-wasm.mjs`. Dependencias `@capacitor-community/sqlite` y `jeep-sqlite`.
- **4a.2**: `core/local/` con `MotorSqlite`, `abrir-sqlite` (web vacía y Capacitor), `esquema.ts` (v1) y `BaseLocalService` (una cosa a la vez, transacciones, migraciones). Ajustes muestra "Datos en la tablet". 6 pruebas nuevas con un motor falso.
- Problemas encontrados y resueltos: la versión *lazy* de `jeep-sqlite` (`loader`) se quedaba esperando para siempre con el servidor de desarrollo de Angular (se usa `dist/components`, más un límite de 20 s al abrir); el `.wasm` de sql.js 1.16.0 no coincidía con el que trae `jeep-sqlite` (`LinkError`); `inject()` después de un `await` en un inicializador (se separó en su propio `provideAppInitializer`).
- Validado en el navegador con `npm run dev:tablet`: base v1 creada en IndexedDB, persiste al recargar y no se vuelve a migrar. Pruebas del frontend y builds de web y android. El plugin no aparece en el build de la web.

### 2026-11-13 — v1.3.0 en producción

- Respaldo de producción con pgAdmin y capturas del resumen y las liquidaciones antes del despliegue.
- Merge `feature/web-solo-lectura` → `develop` → `main`. Sin migraciones; el despliegue quedó *Active*.
- Verificado en producción: la web captura como antes (bandera en `true`), resumen y liquidaciones iguales a las capturas, `/api/sync/estado` sin contacto ni rechazadas, y la app abre bien después de que el servicio se duerme.
- Tag `v1.3.0` creado sobre `main` y subido a GitHub después de verificar.

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
- `jeep-sqlite` trae adentro el JavaScript de sql.js: el `sql-wasm.wasm` debe ser de esa misma versión (hoy 1.12.0). Antes de actualizar `jeep-sqlite`, revisar qué sql.js trae y ajustar `copiar-wasm.mjs`.
- Con el servidor de desarrollo de Angular, usar `jeep-sqlite/dist/components` y no `jeep-sqlite/loader` (la carga *lazy* nunca termina).
- En un `provideAppInitializer` asíncrono, todos los `inject()` van antes del primer `await`.
- Editar con fin de línea LF: un archivo guardado en CRLF aparece reescrito completo en `git diff`.
