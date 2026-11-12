# Registro de cambios

Cambios importantes de la app, por versión. El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y las versiones siguen [SemVer](https://semver.org/lang/es/). Cada versión publicada tiene su tag `vX.Y.Z` sobre `main`.

El estado del proyecto, las decisiones y el registro de trabajo están en [docs/BITACORA.md](docs/BITACORA.md).

## [Sin publicar]

Paso 3 del plan sin conexión: la web queda de solo lectura, muestra cuándo sincronizó la tablet y las operaciones rechazadas, y reintenta sola cuando el servidor está despertando. Está en la rama `feature/web-solo-lectura`. Falta probar el APK con estos cambios antes de publicarlo.

### Agregado

- `GET /api/sync/estado`: último contacto de la tablet y número de operaciones rechazadas. Consultarlo no cuenta como contacto.
- `GET /api/sync/rechazadas`: rechazos con motivo, intentos y hora de la tablet, los más recientes primero (hasta 100), más el total.
- `shared`: `EstadoSyncDto`, `OperacionRechazadaDto`, `OperacionesRechazadasDto` y `MAX_RECHAZADAS_LISTA`.
- Web: pantalla **Inicio** (`/inicio`) con las ventas del día y los trailers en el andén.
- Web: aviso "Última sincronización de la tablet: hace X" bajo la barra superior. Se revisa cada minuto mientras la app está visible, se pone en amarillo después de 30 minutos y no aparece si la tablet nunca ha sincronizado. Lleva a la pantalla de Sincronización.
- Pantalla **Sincronización** (`/sincronizacion`): último contacto y operaciones rechazadas con su descripción (venta, alta de trailer, cierre…), motivo, intentos y los datos tal como llegaron.
- Reintento automático ante un 503 del servidor (arranque en frío de Railway): las consultas y el login se reintentan hasta 3 veces según `Retry-After`, con la barra "El servidor está despertando…". Lo que guarda no se reintenta solo, para no duplicar vales.
- Pruebas del frontend: `haceCuanto`, `describirOperacion` y el interceptor de reintento.
- `probar-sync.ts` revisa también el estado, la lista de rechazadas y que una rechazada salga de la lista al aplicarse.
- `backend/src/requests/sync.http`.

### Cambiado

- La web es de **solo lectura**. `capturaHabilitada` en los environments (`false` en la web y `true` en el APK) decide qué se muestra. En la web, `/vender` y `/trailers/nuevo` no existen (`canMatch`) y mandan a Inicio. Se ocultan registrar, cerrar y reabrir trailers y cancelar vales. El APK no cambia.
- La web inicia en Inicio y su menú es Inicio · Trailers · Vales · Resumen. En el APK sigue iniciando en Vender.
- Al abrir la app con un usuario guardado, ya no espera a `/api/auth/yo`: abre de inmediato y revisa la sesión en segundo plano.
- Las rutas REST de escritura siguen activas en el backend, porque el APK todavía captura con ellas. Se apagan al final del paso 4.

### Corregido

- Un 503 al abrir la app (servidor despertando) borraba el usuario y mandaba al login. Ahora solo un 401 cierra la sesión.
- `core/pwa/errores-red.ts` revisaba `instanceof HttpResponse`, que nunca coincide con un error de `HttpClient` (`HttpErrorResponse`). Por eso el login y Ajustes mostraban "Ocurrió un error inesperado" cuando no había conexión.
- La prueba `app.spec.ts` fallaba por no tener proveedor de `SwUpdate`.

## [1.2.0] — 2026-11-12

Backend listo para que la tablet capture sin conexión, y tolerancia al arranque en frío de Railway.

### Agregado

- `POST /api/sync`: aplica en orden lotes de hasta 100 operaciones de la tablet, cada una en su propia transacción. Es idempotente por el UUID de la operación (`operaciones_sync`): un reenvío responde `YA_APLICADA`. Los rechazos de negocio o de datos se responden con su motivo y el lote sigue.
- `GET /api/sync/snapshot`: trailers activos, todos sus vales y el último folio, leídos en una transacción `REPEATABLE READ`.
- Migración `20261111222142_sync_rechazos_y_contacto`: tablas `operaciones_rechazadas` (rechazos con motivo e intentos) y `estado_sync` (último contacto de la tablet). Solo crea tablas.
- `shared`: esquemas Zod de las 8 operaciones de la tablet (`operaciones.ts`) y DTOs de sincronización (`sync.ts`).
- Pruebas automáticas de `shared` con Vitest (`npm test -w shared`).
- Scripts de verificación del backend: `foto-calculos.ts`, `probar-escrituras.ts` y `probar-sync.ts`.

### Cambiado

- Las reglas de negocio pasaron a `@abastos/shared/reglas` como funciones puras (venta, folio, cancelación, manifiesto, liquidación y resumen), para que el backend y la tablet usen el mismo código. Sin cambios visibles.
- El dinero se calcula en `shared` como centavos enteros. La base sigue en `Decimal(12,2)`.
- Cada escritura del backend es una función `aplicar…(tx, …)` que comparten las rutas REST y `/api/sync`.
- Las correcciones al manifiesto y las cancelaciones corren en transacción y bloquean la línea o el vale.
- Un vale con id o folio ya usados se rechaza con un mensaje claro.
- Límite de 1 MB en el cuerpo de `/api/sync` (100 KB en lo demás).

### Corregido

- La primera petición después de que el servicio despertaba podía fallar con ETIMEDOUT o un error 500. Ahora el backend espera a la base hasta unos 20 s y, si no responde, contesta 503 con "El servidor está despertando…" y `Retry-After`.
- Un cuerpo demasiado grande o con JSON inválido respondía 500. Ahora responde 413 o 400.
- Una corrección del manifiesto simultánea a una venta podía dejar la línea con menos cajas de las vendidas.

## [1.1.0] — 2026-11-04

APK de Android e ids preparados para trabajar sin conexión.

### Agregado

- APK de Android con Capacitor 8 (`com.chiles.ventas`): configuración `android` en `angular.json`, `environment.android.ts`, `apiBaseUrlInterceptor`, `CapacitorHttp` y scripts `build:android` y `android`.
- `Ticket.folio`: folio consecutivo independiente del id. Los vales existentes conservaron su número.
- Tabla `operaciones_sync`, como preparación para la sincronización.

### Cambiado

- Los ids de trailers, líneas de manifiesto, vales y detalles pasaron de enteros a UUID. La migración `20261104184003_ids_uuid` se escribió a mano para conservar los datos.
- Las líneas se ordenan con `compararLineas` (producto, color según el catálogo y tamaño según la hoja), porque el UUID ya no refleja el orden de captura.

## [1.0.0] — 2026-10-29

Primera versión en producción (Railway).

### Agregado

- Trailers con manifiesto y gastos (piso, flete, descarga y comisión); cierre y reapertura; lista de cerrados con buscador y "Ver más".
- Vales con validación de existencias y bloqueo de filas; cancelación sin borrar.
- Resumen del día y liquidación por trailer, imprimible.
- Catálogo de productos en `shared` (Morrón y sus colores).
- PWA: la app abre sin red (nivel 1) y muestra los últimos datos consultados (nivel 2).
- Login de un solo usuario: sesión por cookie guardada en la base, argon2 y límite de intentos.
- Express sirve el build de Angular; despliegue en Railway con migraciones en el pre-deploy.

[Sin publicar]: https://github.com/ELopezSingh/abastos-venta/compare/v1.2.0...develop
[1.2.0]: https://github.com/ELopezSingh/abastos-venta/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/ELopezSingh/abastos-venta/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/ELopezSingh/abastos-venta/releases/tag/v1.0.0
