# Ventas Abastos — Documentación del proyecto

App para registrar las ventas de chile que hace el tío desde el andén en la Central de Abastos de la CDMX. Sustituye los vales escritos a mano y la hoja de Excel con la que se liquida cada viaje a los jefes. Funciona como app web instalable (PWA) y como APK de Android (Capacitor).

> **Estado al 13 de noviembre de 2026:** versión **v1.3.0** (Railway). El tío ya captura ventas reales, por ahora desde la web en el iPhone. El backend tiene la sincronización para el modo sin conexión de la tablet (`/api/sync`) y la web ya tiene su modo solo lectura (paso 3), que se activa cuando el tío tenga la tablet. Falta la tablet con base local (paso 4).
>
> - Qué cambió en cada versión: [CHANGELOG.md](CHANGELOG.md)
> - Estado del proyecto, decisiones y registro de trabajo: [docs/BITACORA.md](docs/BITACORA.md)

---

## Índice

1. [Qué hace la app](#1-qué-hace-la-app)
2. [Glosario del negocio](#2-glosario-del-negocio)
3. [Stack y arquitectura](#3-stack-y-arquitectura)
4. [Estructura del repositorio](#4-estructura-del-repositorio)
5. [Modelo de datos](#5-modelo-de-datos)
6. [API (backend)](#6-api-backend)
7. [Reglas de negocio](#7-reglas-de-negocio)
8. [Frontend: pantallas y navegación](#8-frontend-pantallas-y-navegación)
9. [Autenticación](#9-autenticación)
10. [Funcionamiento sin conexión](#10-funcionamiento-sin-conexión)
11. [Cómo clonar y levantar el proyecto](#11-cómo-clonar-y-levantar-el-proyecto)
12. [Scripts disponibles](#12-scripts-disponibles)
13. [Pruebas](#13-pruebas)
14. [Problemas conocidos y soluciones](#14-problemas-conocidos-y-soluciones)
15. [Despliegue, versiones y respaldos](#15-despliegue-versiones-y-respaldos)
16. [Pendientes y siguientes pasos](#16-pendientes-y-siguientes-pasos)

---

## 1. Qué hace la app

- **Registrar trailers** que llegan al andén, con su manifiesto (producto, color, tamaño y número de cajas) y sus gastos (piso, flete, descarga y porcentaje de comisión).
- **Vender**: generar vales (tickets) para un cliente con una o varias líneas, validando en tiempo real que haya cajas disponibles. Cada vale lleva un **folio consecutivo**.
- **Consultar y cancelar vales** del día. Un vale cancelado no se borra: queda marcado y sus cajas regresan al inventario.
- **Corregir el manifiesto** de un trailer: editar, agregar o eliminar líneas, sin bajar de lo ya vendido.
- **Cerrar y reabrir trailers**. Los cerrados se consultan en una pestaña aparte con buscador y paginación.
- **Resumen del día**: vales, cajas, ventas, gastos de andén y ganancia, además de lo vendido por cada trailer.
- **Liquidación por trailer**: el equivalente a la hoja de Excel del tío (ventas por producto y tamaño, gastos y balance), imprimible o guardable como PDF.
- **Funciona con mala señal**: la web abre sin red y muestra los últimos datos consultados. La tablet (en desarrollo, ver [sección 10](#10-funcionamiento-sin-conexión)) podrá vender sin señal y sincronizar después.
- **Login** de un solo usuario. El usuario se crea por comando y no hay pantalla de registro.

**Dispositivos.** El tío va a capturar en una **tablet Samsung (Android)** con el APK. Se eligió Android en lugar del iPad por compatibilidad y para evitar la licencia anual de desarrollador de Apple. La versión web se conserva para que pueda **consultar** desde su iPhone. Hoy (v1.2.0) las dos versiones todavía permiten capturar; en el paso 3 del plan la web queda solo de lectura y capturar será exclusivo de la tablet. Nunca se captura en dos dispositivos a la vez.

---

## 2. Glosario del negocio

| Término | Significado |
|---|---|
| **Vale** | Ticket de venta. Su `id` es el folio consecutivo. |
| **Andén** | Lugar de descarga y venta en la Central de Abastos. |
| **Trailer** | Camión que llega con mercancía de un invernadero. |
| **Viaje** | Identificador de una entrega en particular (ej. `HORTIFRESH-01`). Lo asignan el tío o sus jefes y se captura a mano, nunca se genera solo. Es lo que encabeza la liquidación. |
| **Número de trailer** | Identifica al camión. El mismo camión puede hacer muchos viajes. |
| **Manifiesto** | Lista de lo que trae el trailer: producto, color, tamaño y cajas. |
| **Piso** | Nombre que tiene en el Excel el **costo de andén**. |
| **Comisión** | Lo que cobra el tío sobre las ventas, normalmente el 10 %. |
| **Balance** | Venta menos gastos (flete + piso + descarga + comisión). Es lo que se liquida al dueño de la mercancía. |
| **Liquidación** | Resumen de un viaje/trailer que el tío manda a sus jefes. |

---

## 3. Stack y arquitectura

Todo el proyecto está en **TypeScript**, en un monorepo con **npm workspaces**.

| Paquete | Tecnología | Rol |
|---|---|---|
| `shared` (`@abastos/shared`) | TypeScript + Zod 4 + Vitest | Esquemas de validación, DTOs, catálogos, **reglas de negocio** (funciones puras) y aritmética de dinero. Lo usan back, web y tablet. Zod está configurado en español. |
| `backend` | Node 24 + Express 5 + Prisma 7 + PostgreSQL | API REST bajo `/api`, incluida la sincronización de la tablet. En producción también sirve el build de Angular. |
| `frontend` | Angular 22 (zoneless, signals, Signal Forms, `httpResource`) + `@angular/service-worker` + Capacitor 8 | PWA para el navegador y APK de Android para la tablet, con el mismo código. |

Decisiones clave:

- **Dinero.** En la base, los importes son `Decimal(12,2)`. Las reglas de `shared` calculan en **centavos enteros** (`shared/src/dinero.ts`): exactos y sin dependencias, y la tablet los podrá guardar así en SQLite. El backend convierte solo en la frontera: `centavosDe()` al leer (`backend/src/lib/dinero.ts`) y `centavosATexto()` al guardar. La comisión se redondea al centavo "mitad hacia arriba", igual que `Decimal.toDecimalPlaces(2)`. El frontend nunca es la fuente de verdad del dinero.
- **Reglas de negocio en `shared/src/reglas/`**, como funciones puras con pruebas: venta (`prepararTicket`), folio, cancelación, correcciones al manifiesto, liquidación y resumen del día. Backend y tablet usan el mismo código. Lanzan `ErrorDeRegla` (`NO_ENCONTRADO`, `CONFLICTO`, `INVALIDO`) y el backend lo traduce a `AppError` (404/409/400) con `conReglas()`.
- **Funciones "aplicar".** Cada escritura del backend es una función `aplicar…(tx, …)` que recibe la transacción, los ids y la hora. Las rutas REST y `/api/sync` usan las mismas funciones.
- **Ids UUID.** Trailers, líneas de manifiesto, tickets y detalles usan UUID, que puede generar la tablet sin conexión. El **folio** del vale es un número aparte (`Ticket.folio`, único); los vales anteriores a v1.1.0 conservaron su número.
- **URLs de la API.** La web usa rutas relativas `/api/...`: en desarrollo el proxy de Angular (`proxy.conf.json`) las manda a `http://localhost:3000`, y en producción Express sirve la web en el mismo origen (sin CORS, cookie *first-party*). El APK usa `environment.android.ts` (URL de Railway), `apiBaseUrlInterceptor` y `CapacitorHttp`, que maneja las cookies de forma nativa.
- **Prisma 7**: la URL de conexión vive en `backend/prisma.config.ts` (no en `schema.prisma`), el cliente se genera en `backend/src/generated/prisma` (ignorado en git) y se conecta con el adaptador `@prisma/adapter-pg` (con `connectionTimeoutMillis` de 5 s).
- **Express 5** manda solo al `errorHandler` los errores de funciones `async`, incluidos los `ZodError` de `.parse()`.
- **Fechas**: el "día" se calcula en horario de la CDMX: `hoyCdmx()` en `frontend/src/app/core/fechas.ts` y `hoyCdmx()`/`rangoDelDia()` en `backend/src/lib/fechas.ts`.
- **Arranque en frío**: el servicio de Railway duerme cuando no se usa. El middleware `esperarBaseDeDatos` espera a que la base responda antes de atender `/api` (ver [sección 6](#6-api-backend)).

---

## 4. Estructura del repositorio

Resumen de las piezas principales. Puede haber archivos auxiliares que no aparecen aquí.

```text
abastos-venta/
├── package.json              # raíz: workspaces y scripts generales
├── railway.json              # build, arranque, pre-deploy (migraciones) y healthcheck
├── README.md                 # este documento
├── CHANGELOG.md              # cambios por versión
├── docs/
│   └── BITACORA.md           # estado actual, decisiones y registro de trabajo
├── .gitignore                # node_modules, dist, .env, backend/src/generated, .angular
├── .editorconfig / .prettierrc
├── shared/
│   ├── package.json          # @abastos/shared
│   ├── src/
│   │   ├── index.ts          # reexporta todo
│   │   ├── comun.ts          # idSchema (UUID), idParamSchema
│   │   ├── dinero.ts         # importe, cajas y aritmética en centavos (Centavos, aCentavos, porcentajeDe…)
│   │   ├── errores.ts        # ErrorDeRegla y esErrorDeRegla
│   │   ├── catalogos.ts      # productos, colores, tamaños, formatearFolio, compararLineas
│   │   ├── trailer.ts        # esquemas y DTOs de trailers y cerrados
│   │   ├── ticket.ts         # esquemas y DTOs de vales
│   │   ├── resumen.ts        # DTOs de resumen del día y liquidación
│   │   ├── operaciones.ts    # las 8 operaciones que manda la tablet (Zod)
│   │   ├── sync.ts           # lote de sincronización, resultados y snapshot
│   │   ├── auth.ts           # loginSchema, LoginInput, SesionUsuario
│   │   └── reglas/           # reglas de negocio puras
│   │       ├── ventas.ts     # prepararTicket, siguienteFolio, validarCancelacion
│   │       ├── manifiesto.ts # correcciones de líneas, cierre, valores por defecto
│   │       ├── liquidacion.ts# calcularLiquidacion
│   │       └── resumen.ts    # calcularResumenDia
│   └── test/                 # pruebas con Vitest (npm test -w shared)
├── backend/
│   ├── package.json
│   ├── tsconfig.json         # incluye "noImplicitReturns": true
│   ├── prisma.config.ts
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/       # se versionan en git
│   ├── scripts/              # verificación contra la base local (ver sección 13)
│   │   ├── foto-calculos.ts
│   │   ├── probar-escrituras.ts
│   │   └── probar-sync.ts
│   └── src/
│       ├── server.ts         # app.listen(PORT)
│       ├── app.ts            # middlewares, rutas y archivos de la web
│       ├── config/env.ts     # validación de variables de entorno con Zod
│       ├── lib/
│       │   ├── prisma.ts     # PrismaClient con adaptador pg y tipo Db
│       │   ├── dinero.ts     # Decimal ↔ número/centavos
│       │   ├── fechas.ts     # hoyCdmx, rangoDelDia
│       │   ├── reglas.ts     # conReglas: ErrorDeRegla → AppError
│       │   ├── bloqueos.ts   # bloquearLineas (FOR UPDATE)
│       │   └── conexion.ts   # detección de errores de conexión y estado
│       ├── middlewares/
│       │   ├── error-handler.ts        # AppError, Zod, 413, 503
│       │   ├── requiere-sesion.ts      # protege /api
│       │   └── esperar-base-de-datos.ts# arranque en frío
│       ├── modules/
│       │   ├── health/       # GET /api/health
│       │   ├── auth/         # sesiones.ts, auth.routes.ts
│       │   ├── trailers/     # trailers.service.ts, trailers.routes.ts
│       │   ├── tickets/      # tickets.service.ts, tickets.routes.ts
│       │   ├── resumen/      # resumen.service.ts, resumen.routes.ts
│       │   └── sync/         # sync.service.ts, sync.routes.ts
│       ├── requests/         # archivos .http para REST Client
│       └── scripts/
│           └── crear-usuario.ts
└── frontend/
    ├── package.json
    ├── angular.json          # configuraciones production, development y android
    ├── capacitor.config.ts   # appId com.chiles.ventas, CapacitorHttp activado
    ├── android/              # proyecto nativo de Android (Capacitor)
    ├── proxy.conf.json       # /api → http://localhost:3000
    ├── ngsw-config.json      # assetGroups + dataGroups (caché de /api/**)
    └── src/
        ├── index.html        # meta tags de iOS para la PWA
        ├── manifest.webmanifest
        ├── styles.scss       # variables (:root) y clases globales (.boton, .campo…)
        ├── environments/     # environment.ts (web) y environment.android.ts (APK)
        └── app/
            ├── app.ts / app.html / app.scss   # shell: barra superior, estado PWA, nav inferior
            ├── app.config.ts
            ├── app.routes.ts
            ├── core/
            │   ├── auth/      # auth.service, auth.guards, auth.interceptor
            │   ├── captura.ts # CAPTURA_HABILITADA y RUTA_INICIO (modo captura o solo lectura)
            │   ├── reintento-503.interceptor.ts  # reintenta consultas y login ante un 503
            │   ├── estado-servidor.service.ts    # "El servidor está despertando…"
            │   ├── pwa/       # conexion, actualizaciones, precarga, sin-conexion.interceptor,
            │   │              # barra-estado-pwa, datos-guardados, aviso-conexion-guardar, errores-red
            │   ├── api-base-url.interceptor.ts  # antepone la URL de Railway en el APK
            │   ├── errores.ts # mensajeDeError, mensajeDeErrorAlGuardar
            │   ├── fechas.ts  # hoyCdmx, sumarDias
            │   ├── catalogos.ts      # colorDeChile, nombres para mostrar
            │   ├── selector-dia.ts   # flechas día anterior/siguiente + fecha
            │   ├── error-campo.ts
            │   └── esquema-borrador.ts
            ├── login/          # login-page
            ├── ajustes/        # ajustes-page (cerrar sesión)
            ├── inicio/         # inicio-page (web en solo lectura)
            ├── sincronizacion/ # estado-tablet (aviso), rechazadas-page, sync.api
            ├── trailers/
            │   ├── lista/      # trailers-page (Activos / Cerrados) y trailers-cerrados (buscador + Ver más)
            │   └── nuevo/      # nuevo-trailer-page
            ├── vales/
            │   ├── nuevo/      # nuevo-vale-page (Vender)
            │   └── lista/      # vales-page
            └── resumen/
                ├── dia/        # resumen-dia-page
                ├── liquidacion/# liquidacion-page
                └── resumen.api.ts
```

---

## 5. Modelo de datos

Base PostgreSQL gestionada con Prisma. Las columnas en la base usan `snake_case` (`@map`) y las tablas, plural (`@@map`).

### Enums

- `EstadoTrailer`: `ACTIVO`, `CERRADO`
- `EstadoTicket`: `VIGENTE`, `CANCELADO`

### `Trailer` → tabla `trailers`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | UUID | Lo genera la tablet (o el servidor, desde la web). |
| `viaje` | String? | Nombre del viaje (ej. `HORTIFRESH-01`). Es opcional en la base solo por los trailers previos al campo; el formulario lo exige. |
| `placa`, `numero`, `invernadero`, `chofer`, `anden` | String | |
| `costoAnden` | Decimal(12,2) | "Piso" en el Excel |
| `flete` | Decimal(12,2) | default 0 |
| `descarga` | Decimal(12,2) | default 0 |
| `comisionPorcentaje` | Decimal(5,2) | default 10 (10 = 10 %) |
| `fechaLlegada` | DateTime | Hora de llegada; si viene de la tablet, la hora en que se capturó. |
| `fechaCierre` | DateTime? | se llena al cerrar y se borra al reabrir |
| `estado` | EstadoTrailer | default `ACTIVO` |
| `createdAt`, `updatedAt` | DateTime | |

Índices: `fechaLlegada` y `(estado, fechaCierre)`.

### `ManifiestoDetalle` → tabla `manifiesto_detalle`

Cada producto/tamaño que trae un trailer: `id` (UUID), `trailerId`, `producto`, `color?`, `tamano`, `cajas`. Las ventas apuntan aquí, así se sabe de qué trailer salió cada caja y cuántas quedan. Se borra en cascada con su trailer.

### `Ticket` (vale) → tabla `tickets`

`id` (UUID), `folio` (Int, **único**: el número impreso), `fecha`, `clienteNombre`, `total` Decimal(12,2), `estado` (default `VIGENTE`), `createdAt`. Por ahora no hay tabla de clientes: el nombre se guarda como texto.

### `TicketDetalle` → tabla `ticket_detalle`

`id` (UUID), `ticketId`, `manifiestoDetalleId`, `cajas`, `precioCaja`, `subtotal`. La relación con el manifiesto es `Restrict`: no se puede borrar una línea del manifiesto que tenga ventas.

### Sincronización de la tablet

| Modelo → tabla | Para qué |
|---|---|
| `OperacionSync` → `operaciones_sync` | Operaciones aplicadas: `id` (UUID de la operación), `seq` (orden, autoincremental), `tipo`, `datos` (JSON tal como llegó), `creadaEn` (hora en la tablet) y `aplicadaEn`. Su `id` hace que un reenvío no se aplique dos veces. |
| `OperacionRechazada` → `operaciones_rechazadas` | Operaciones que el servidor rechazó, para revisarlas a distancia: `id`, `tipo`, `datos`, `creadaEn`, `motivo`, `intentos`, `primeraVez`, `ultimaVez`. Si luego se aplica, se borra de aquí. |
| `EstadoSync` → `estado_sync` | Una sola fila (`id = 1`) con `ultimoContacto`: la última vez que la tablet llamó a `POST /api/sync`. |

### `Usuario` → tabla `usuarios`

`id` (Int), `usuario` (único, en minúsculas), `hashContrasena` (argon2), `creadoEn`.

### `Sesion` → tabla `sesiones`

`id` (Int), `tokenHash` (único, SHA-256 del token), `usuarioId` (cascada), `expiraEn`, `creadoEn`.

### Migraciones aplicadas

| Migración | Versión | Qué hace |
|---|---|---|
| `20261022221825_inicial` | 1.0.0 | Trailers, manifiesto, tickets y detalle. |
| `20261023171842_gastos_trailer` | 1.0.0 | `flete`, `descarga` y `comisionPorcentaje`. |
| `20261026233403_viaje_y_cierre` | 1.0.0 | `viaje` y `fechaCierre`. Con un `UPDATE` a mano para que los trailers ya cerrados tomaran `updated_at` como fecha de cierre. |
| `20261028163624_autenticacion` | 1.0.0 | `usuarios` y `sesiones`. |
| `20261104184003_ids_uuid` | 1.1.0 | Ids enteros → UUID, `folio` en tickets y `operaciones_sync`. **Escrita a mano** para conservar los datos; no se regenera con Prisma. |
| `20261111222142_sync_rechazos_y_contacto` | 1.2.0 | `operaciones_rechazadas` y `estado_sync` (solo crea tablas). |

Las migraciones van en el repo y nunca se editan después de aplicadas. Como el tío ya captura ventas reales, toda migración debe conservar los datos (ver [sección 15](#15-despliegue-versiones-y-respaldos)).

---

## 6. API (backend)

Todas las respuestas de error tienen la forma `{ mensaje, errores? }`:

- `400`: datos inválidos (Zod), con el detalle por campo en `errores`; también un cuerpo que no es JSON válido.
- `401`: sin sesión o sesión vencida.
- `404` / `409`: errores de negocio (`AppError` o `ErrorDeRegla` traducido), por ejemplo, no hay cajas suficientes → 409.
- `413`: el cuerpo es demasiado grande (100 KB en general, 1 MB en `/api/sync`).
- `503`: la base de datos no responde, normalmente porque el servicio acaba de despertar. Mensaje: "El servidor está despertando. Intenta de nuevo en unos segundos." y encabezado `Retry-After: 5`.
- `500`: error interno (se registra en consola).

### Orden de middlewares en `app.ts`

```text
trust proxy (1) → cors → express.json (1 MB en /api/sync, 100 KB en lo demás) → cookieParser
/api          → esperarBaseDeDatos   ← si no hubo contacto con la base en 60 s, SELECT 1 con reintentos (~20 s)
/api/health   (público)
/api/auth     (público, salvo /yo)
/api          → requiereSesion       ← todo lo de abajo exige sesión
/api/trailers, /api/tickets, /api/resumen, /api/sync
archivos de la web + fallback de SPA (solo si existe el build)
errorHandler
```

### Salud

| Método y ruta | Qué hace |
|---|---|
| `GET /api/health` | Hace `SELECT 1` y responde `{ estado: 'ok', baseDeDatos: 'conectada' }`. Railway lo usa como healthcheck. |

### Autenticación

| Método y ruta | Qué hace |
|---|---|
| `POST /api/auth/login` | Recibe `{ usuario, contrasena }`, crea la sesión y manda la cookie. Límite: 10 intentos fallidos por IP cada 15 min. |
| `POST /api/auth/logout` | Borra la sesión y la cookie (204). |
| `GET /api/auth/yo` | Devuelve `{ usuario }` si hay sesión válida. |

### Trailers

| Método y ruta | Qué hace |
|---|---|
| `POST /api/trailers` | Crea el trailer con su manifiesto en una sola transacción. |
| `GET /api/trailers?estado=ACTIVO` | Lista trailers con cajas vendidas y disponibles por línea, más totales. |
| `GET /api/trailers/cerrados?q=&desde=` | Cerrados, del cierre más reciente al más antiguo, 20 por página. `q` busca en viaje, número, invernadero o placa (sin distinguir mayúsculas). Responde `{ trailers, siguiente }`, donde `siguiente` es el valor de `desde` para la siguiente página o `null`. Esta ruta va **antes** de `/:id`. |
| `GET /api/trailers/:id` | Detalle de un trailer (solo se usa en los `.http`). |
| `PATCH /api/trailers/:id` | Corrige datos generales (andén, costo, chofer…). |
| `POST /api/trailers/:id/cerrar` | Cierra y guarda `fechaCierre`. |
| `POST /api/trailers/:id/reabrir` | Reabre y borra `fechaCierre`. |
| `POST /api/trailers/:id/manifiesto` | Agrega una línea al manifiesto. |
| `PATCH /api/trailers/:id/manifiesto/:lineaId` | Corrige una línea. No deja bajar las cajas por debajo de lo vendido. |
| `DELETE /api/trailers/:id/manifiesto/:lineaId` | Elimina una línea solo si no tiene ventas. |

### Tickets (vales)

| Método y ruta | Qué hace |
|---|---|
| `POST /api/tickets` | Crea un vale: `{ clienteNombre, lineas: [{ manifiestoDetalleId, cajas, precioCaja }] }`. El folio es el último + 1. |
| `GET /api/tickets?fecha=AAAA-MM-DD&estado=VIGENTE` | Vales de un día (por defecto hoy), del folio más alto al más bajo. `estado` es opcional. |
| `GET /api/tickets/:id` | Un vale por su id (UUID). |
| `POST /api/tickets/:id/cancelar` | Marca el vale como cancelado. Sus cajas vuelven a quedar disponibles. |

### Resumen

| Método y ruta | Qué hace |
|---|---|
| `GET /api/resumen/dia?fecha=AAAA-MM-DD` | Vales, cajas vendidas, ventas, gastos de andén y ganancia del día, más lo vendido por trailer. Sin fecha usa hoy. |
| `GET /api/resumen/trailers/:id` | Liquidación del trailer (equivalente a la hoja de Excel). |

### Sincronización (tablet)

| Método y ruta | Qué hace |
|---|---|
| `POST /api/sync` | Recibe `{ operaciones: [...] }` (máximo 100) y las aplica en orden. Responde `{ resultados, horaServidor }` con un resultado por operación: `APLICADA`, `YA_APLICADA` o `RECHAZADA` con su `motivo`. Un lote vacío solo registra el contacto. |
| `GET /api/sync/snapshot` | Carga inicial de la tablet: `{ generadoEn, ultimoFolio, trailers, tickets }`, con los trailers activos y todos sus tickets (vigentes y cancelados). |
| `GET /api/sync/estado` | Para la web: `{ ultimoContacto, rechazadas }`. `ultimoContacto` es `null` si la tablet nunca ha sincronizado. Consultarlo no cuenta como contacto. |
| `GET /api/sync/rechazadas` | Para la web: `{ total, operaciones }` con las rechazadas más recientes primero (por último intento, hasta 100): tipo, motivo, intentos, hora de la tablet y los datos tal como llegaron. |

Cada operación tiene `{ id (UUID), tipo, creadaEn (ISO con zona), datos }`. Los tipos son `trailer.crear`, `trailer.actualizar`, `trailer.cambiarEstado`, `linea.agregar`, `linea.actualizar`, `linea.eliminar`, `ticket.crear` y `ticket.cancelar`. Los esquemas están en `shared/src/operaciones.ts` y las reglas de aplicación, en la [sección 7](#7-reglas-de-negocio).

---

## 7. Reglas de negocio

Las reglas viven en `shared/src/reglas/` como funciones puras con pruebas, y las usan el backend y, más adelante, la tablet. El backend agrega lo que depende de la base: bloqueos, existencia de registros e ids o folios repetidos.

**Ventas**

- Antes de guardar un vale se valida que cada línea del manifiesto exista, que su trailer no esté cerrado y que haya cajas suficientes. Si algo falla no se guarda nada y se responde con un mensaje claro, por ejemplo: "Solo quedan 90 cajas de Morrón Verde MD (trailer T-46); se pidieron 95".
- Si la misma línea viene dos veces en un vale, sus cajas se suman para revisar las existencias.
- Para que dos ventas simultáneas no vendan las mismas cajas, la creación del vale corre en una transacción que **bloquea las filas** del manifiesto involucradas.
- Subtotales y total se calculan en centavos enteros y se guardan como `Decimal` exacto.
- **Folio**: desde la web, el siguiente consecutivo (el último + 1), calculado con un candado (`pg_advisory_xact_lock`) para que dos ventas no tomen el mismo número. Desde la tablet, el folio lo asigna la tablet; si ya lo tiene otro vale, la operación se rechaza.
- Un vale mal hecho se corrige **cancelándolo y haciendo uno nuevo**. No se edita ni se borra, para no perder el rastro de los folios. Cancelar dos veces se rechaza.
- Las cajas vendidas solo cuentan los vales `VIGENTE`. Al cancelar uno, las existencias se recuperan solas.

**Trailers y manifiesto**

- No se puede vender de un trailer cerrado.
- Si al crear un trailer no se mandan flete, descarga o comisión, se usan 0, 0 y 10 %.
- Una línea no puede quedar con menos cajas de las vendidas, y no se puede eliminar si tiene ventas (incluso canceladas). El color debe corresponder al producto según el catálogo.
- Las correcciones al manifiesto y las cancelaciones bloquean la línea o el vale mientras se aplican.
- Los trailers no se ocultan por fecha ni se borran solos, porque las liquidaciones históricas deben seguir disponibles. Por eso existe la pestaña de cerrados.

**Resumen del día**

- Ventas = suma de vales vigentes del día.
- Gastos de andén del día = suma del `costoAnden` de los trailers que **llegaron** ese día.
- **Ganancia neta = ventas − costos de andén.** Es la definición acordada por ahora; puede cambiar (según la hoja del tío, lo que él gana por viaje es la comisión).
- Los vales cancelados no cuentan.

**Liquidación por trailer**

- Ventas por producto y color (como cada bloque de la hoja) y por tamaño: cajas que llegaron, vendidas y restantes, más la lista de ventas (folio, cliente, cajas, precio, total).
- Gastos: flete + piso (`costoAnden`) + descarga + comisión (`comisionPorcentaje` % de la venta, redondeada al centavo).
- Balance = venta − gastos.

**Sincronización de la tablet**

- Cada operación se aplica en su propia transacción, de una en una (candado `pg_advisory_xact_lock(4243)`), en el orden en que llegó.
- **Idempotencia**: si el `id` de la operación ya está en `operaciones_sync`, se responde `YA_APLICADA` sin repetirla.
- **Hora**: las ventas, llegadas y cierres guardan la hora de la tablet (`creadaEn`), así cuentan para el día en que se hicieron aunque se sincronicen después.
- **Rechazos**: un error de negocio o de datos (sin existencias, folio o id repetido, registro inexistente) rechaza esa operación, guarda el motivo en `operaciones_rechazadas` y **sigue con las demás**. Si la tablet reenvía una rechazada, se suma un intento.
- **Errores inesperados** (conexión, fallas del código): no se rechazan, porque no son culpa de la operación. La petición falla y la tablet reintenta; lo ya aplicado vuelve como `YA_APLICADA`.
- **Último contacto**: al terminar cada `POST /api/sync` (aunque venga vacío) se guarda en `estado_sync`.

**Catálogo de productos**

- Vive en `shared/src/catalogos.ts`. Hoy solo se vende Morrón (rojo, amarillo, naranja y verde), pero se pueden agregar variedades (ej. pasilla) **sin migración**, solo editando el catálogo.
- Tamaños, en el orden de la hoja: XXL, XL, LG, MD, SM, CH. Las líneas se ordenan por producto, color (según el catálogo) y tamaño con `compararLineas`.

---

## 8. Frontend: pantallas y navegación

### Shell

- **Barra superior** (solo con sesión): nombre de la app a la izquierda y engrane de Ajustes a la derecha. No es fija; se va con el scroll.
- **`app-barra-estado-pwa`**: aparece solo cuando no hay red, cuando el servidor está despertando (503) o cuando hay una actualización pendiente.
- **`app-estado-tablet`** (solo en modo solo lectura): "Última sincronización de la tablet: hace X" bajo la barra superior. Se revisa cada minuto con la app visible, se pone amarillo después de 30 min, no aparece si la tablet nunca ha sincronizado y lleva a `/sincronizacion`.
- **Navegación inferior** (solo con sesión): en modo captura, Trailers · Vender · Vales · Resumen; en solo lectura, Inicio · Trailers · Vales · Resumen.
- Al imprimir se ocultan la navegación y los controles marcados `.no-imprimir`.

### Modo captura y modo solo lectura

`capturaHabilitada` en los environments (`core/captura.ts`) se fija al compilar:

- **`true` (modo captura)**: el APK siempre. Inicia en `/vender` y no hay aviso de la tablet. `/inicio` y `/sincronizacion` existen, aunque no están en el menú.
- **`false` (solo lectura)**: la web, cuando el tío tenga la tablet. `/vender` y `/trailers/nuevo` no existen (`canMatch`) y caen a Inicio; se ocultan registrar, cerrar y reabrir trailers y cancelar vales. La lógica sigue en los componentes, solo oculta.
- **En v1.3.0 la web se publica con `true`**, porque el tío todavía captura desde el iPhone. Se cambia a `false` cuando tenga la tablet con el APK, a más tardar con el paso 4.

### Rutas

| Ruta | Pantalla | Notas |
|---|---|---|
| `/login` | Login | `invitadoGuard`: si ya hay sesión, manda a `/`. |
| `/` | → `/vender` (captura) o `/inicio` (solo lectura) | Todo lo de abajo cuelga de un padre con `canActivateChild: [sesionGuard]`. |
| `/inicio` | Inicio | Ventas del día y trailers en el andén. Es la pantalla de inicio en solo lectura. |
| `/vender` | Nuevo vale | Solo en modo captura; es su pantalla de inicio. En iPad, la captura va a la izquierda y los productos a la derecha; en teléfono, en una columna. Valida existencias en tiempo real. |
| `/vales` | Vales del día | Total, cajas y cancelados del día. Cada vale muestra folio, hora, cliente, líneas (con trailer) y total. Cancelar pide confirmación ("Las N cajas vuelven a quedar disponibles"). |
| `/trailers` | Trailers | Pestaña **Activos**: tarjetas con barra de existencias por color, detalle por tamaño, "Ver liquidación" y "Cerrar trailer" (con confirmación). Pestaña **Cerrados**: tarjetas compactas, buscador con *debounce* ("Viaje, trailer, invernadero o placa"), "Ver más" de 20 en 20 y botón Reabrir. |
| `/trailers/nuevo` | Registrar trailer | Solo en modo captura. Datos generales, viaje, gastos, comisión (10 por defecto) y manifiesto con varias líneas. Usa Signal Forms validados con los esquemas de `shared`. |
| `/trailers/:id/liquidacion` | Liquidación | Botón de imprimir (`window.print()`): en iPhone permite guardar como PDF o compartir. |
| `/resumen` | Resumen del día | Selector de día (anterior/siguiente/fecha). |
| `/sincronizacion` | Sincronización | Último contacto de la tablet y operaciones rechazadas con su descripción, motivo, intentos y los datos tal como llegaron. |
| `/ajustes` | Ajustes | Sección "Cuenta": usuario actual y "Cerrar sesión" con confirmación en la misma pantalla. |
| `**` | → igual que `/` | |

### Convenciones de UI

- Todo el texto y los mensajes de validación están en español.
- Locale `es-MX` y moneda `MXN` (`LOCALE_ID` y `DEFAULT_CURRENCY_CODE`).
- Estilos globales en `styles.scss` con variables (`--primario`, `--superficie`, `--linea`, `--tinta-suave`, `--peligro`, `--peligro-fondo`, `--radio`, `--radio-chico`, `--toque: 48px`, `--alto-nav: 64px`, `--fuente-cifras`…) y clases reutilizables (`.boton`, `.boton--secundario`, `.boton--peligro`, `.boton--ancho`, `.campo`, `.cifra`).
- Inputs con `font-size` ≥ 16 px para que iOS no haga zoom.
- Las acciones delicadas (cerrar trailer, cancelar vale, cerrar sesión) **dejan el botón activo** y el aviso de "necesitas conexión" aparece dentro de la confirmación.

---

## 9. Autenticación

**Modelo**: un solo usuario, sesión por cookie guardada en una tabla de Prisma (no JWT ni `express-session`).

- Al hacer login se genera un token aleatorio (32 bytes, base64url). Viaja en la cookie `sesion`; en la base solo se guarda su **hash SHA-256**.
- Cookie `httpOnly`, `SameSite=Strict`, `path=/` y `Secure` cuando `NODE_ENV=production`.
- **Expiración deslizante**: la sesión dura 30 días. Si le quedan menos de 15, se renueva a 30 en la siguiente petición y se reenvía la cookie.
- Al crear una sesión se borran las sesiones vencidas.
- Contraseñas con **argon2**. Si el usuario no existe, se verifica contra un hash de relleno para que la respuesta tarde lo mismo y no se pueda adivinar qué usuarios existen.
- **Rate limit** en el login: 10 intentos fallidos por IP cada 15 minutos (`express-rate-limit`).
- `app.set('trust proxy', 1)` ya está puesto para Railway. Sin eso fallarían la cookie `Secure` y el límite por IP.

**Crear usuario o cambiar contraseña** (sin pantalla de registro):

```bash
npm run usuario:crear -w backend
```

Pide usuario y contraseña (mínimo 10 caracteres, sin mostrarla en pantalla) y la confirmación. Si el usuario ya existe, **cambia su contraseña y cierra todas sus sesiones**, útil si se pierde el iPhone. Las credenciales nunca van en el `.env`, en notas ni en el repo: se guardan en un gestor de contraseñas.

**Frontend**


- `AuthService`: signal del usuario actual. Al arrancar llama a `GET /api/auth/yo` con el header `ngsw-bypass` para que el service worker nunca responda desde caché. Si hay un usuario guardado, la app abre de inmediato y la revisión corre en segundo plano. **Solo un 401 cierra la sesión**: sin red o con el servidor despertando (503) se conserva el usuario.
- Sin red al abrir la app, se usa el nombre guardado en `localStorage` del último login (`abastos.usuario`). Es solo el nombre; la sesión real vive en la cookie.
- `sesionGuard` / `invitadoGuard` protegen las rutas.
- `authInterceptor`: cualquier 401 fuera de `/api/auth/` manda al login.
  > Nota a revisar en el paso 4: la excepción compara contra `'/api/auth'`, pero las URLs llegan como `api/auth/...` (o con la URL de Railway en el APK), así que nunca aplica. Hoy no causa problemas (un 401 en el login solo vuelve a mostrar el login), pero la tablet no debe perder nada local cuando la sesión venza.
- La precarga de datos solo corre si hay sesión.
- Cerrar sesión **requiere conexión**; si no, la cookie seguiría viva en el servidor.
- Login con botón propio para mostrar u ocultar la contraseña (se ocultó el de Edge) y `autocapitalize="none"` para iPhone.

---

## 10. Funcionamiento sin conexión

Hay tres niveles. Los niveles 1 y 2 están terminados para la web. El nivel 3 (capturar sin red y sincronizar después) es para la tablet y está en desarrollo: el backend ya está listo (v1.2.0) y la web tiene su modo solo lectura y las pantallas de seguimiento (v1.3.0).

### Nivel 1: la app abre sin red

- `@angular/service-worker` registrado solo en producción (`registerWhenStable:30000`).
- `manifest.webmanifest` y meta tags de iOS en `index.html` para instalarla desde Safari ("Agregar a pantalla de inicio").
- `ActualizacionesService`: avisa cuando hay versión nueva.
- `ConexionService`: signal `enLinea()`.
- `barra-estado-pwa`: muestra el estado de conexión o de actualización.

### Nivel 2: lectura de datos sin red

- `ngsw-config.json` → `dataGroups` sobre `/api/**` con estrategia **`freshness`**: siempre intenta la red y, si no responde en **5 s** o no hay conexión, entrega la última copia guardada. `maxAge: 7d`, `maxSize: 300`. El timeout también cubre la señal débil.
- **La caché es por URL exacta**, incluidos los parámetros y su orden.
- `PrecargaService`: al abrir la app con red y sesión, pide en segundo plano los trailers activos, los vales del día, el resumen del día y la liquidación de cada trailer activo, con las mismas URLs que usan las pantallas (fecha con `hoyCdmx()`). Respeta un intervalo mínimo de 5 minutos.
- `datos-guardados`: lee el header `Date` de la respuesta y, si es viejo, muestra "Mostrando datos de las HH:MM".
- `sinConexionInterceptor`: sin red, corta al instante los POST/PATCH/DELETE con `statusText = SIN_CONEXION_PREVIA`.
- `aviso-conexion-guardar`: aviso junto a los botones de guardar.
- `core/errores.ts`:
  - `mensajeDeError()` para consultas. Distingue entre falta de red (status 0, 504 del service worker o `navigator.onLine` falso) y error del servidor.
  - `mensajeDeErrorAlGuardar()` distingue "no se envió nada" de "se cortó a la mitad; revisa si quedó registrado antes de reintentar", para evitar vales duplicados.
- Al cerrar sesión se borran también los cachés de datos del service worker.

> Nota a revisar: `auth.service.ts`, `login-page.ts` y `ajustes-page.ts` importan `esErrorDeConexion` de `core/pwa/errores-red.ts`, mientras que el resto de la lógica de errores quedó en `core/errores.ts`. Conviene dejar uno solo como fuente.

**Limitaciones de la web**: solo está disponible offline lo que ya se consultó con red; la búsqueda de cerrados funciona sin red solo para combinaciones ya consultadas; guardar siempre requiere conexión.

### Servidor despertando (503)

- Si el backend responde 503 ("El servidor está despertando…"), `reintento503Interceptor` espera lo que indica `Retry-After` (tope de 15 s) y reintenta hasta 3 veces. Mientras tanto, `EstadoServidorService` muestra la barra "El servidor está despertando. Reintentando en unos segundos…".
- Solo se reintentan las consultas (GET/HEAD) y el login. Lo que guarda no se reintenta solo: pudo aplicarse antes de que se cayera la conexión y repetirlo podría duplicar un vale.
- Funciona igual en la web y en el APK.

### APK de Android (Capacitor)

- Mismo código de Angular, compilado con la configuración `android` de `angular.json`: usa `environment.android.ts` (URL de Railway) y **sin service worker**.
- `apiBaseUrlInterceptor` antepone la URL del backend a las rutas `/api/...`.
- `CapacitorHttp` activado en `capacitor.config.ts`: las peticiones salen por la capa nativa y la cookie de sesión funciona contra Railway.
- Cómo generarlo: ver [sección 11.10](#1110-generar-el-apk-de-android).

### Nivel 3: la tablet captura sin red (en desarrollo)

Diseño acordado:

- Cada acción en la tablet se guarda como **operación** (UUID, tipo, datos y hora), se aplica en una base local (SQLite) y entra a una cola. Al haber señal, la cola se manda en orden a `POST /api/sync`, en lotes de hasta 100.
- El servidor aplica cada operación con las mismas reglas de `shared` y registra su UUID: un reenvío nunca duplica nada.
- La tablet genera todos los ids y **asigna el folio**. Es el único dispositivo que captura; la web queda solo de lectura.
- Las operaciones rechazadas se marcan en la tablet con su motivo (no se descartan) y también quedan en el servidor para revisarlas a distancia.
- La web muestra "Última sincronización de la tablet: hace X" y las operaciones rechazadas (hecho en v1.3.0; se ve cuando la web está en solo lectura).
- Para instalar o reinstalar la tablet se usa `GET /api/sync/snapshot`.
- La tablet compara su reloj con el header `Date` del servidor para avisar si está desfasado.
- Si la sesión de 30 días vence sin señal, la tablet pide login y conserva la cola.

Avance por pasos: [sección 16](#16-pendientes-y-siguientes-pasos) y [docs/BITACORA.md](docs/BITACORA.md).

---

## 11. Cómo clonar y levantar el proyecto

Todos los comandos se corren desde la **raíz del monorepo** (`abastos-venta/`) salvo que se diga otra cosa.

### 11.1 Requisitos

- **Node.js 24.15 o superior** (con npm). En Windows se recomienda instalarlo con `nvm-windows`.
- **PostgreSQL** local, administrado con pgAdmin 4 (no se usa Docker).
- **Git**.
- Para el APK: **Android Studio** (incluye el SDK de Android y el JDK).
- Opcional: **VS Code** con la extensión **REST Client** para los archivos `.http`.
- No hace falta tener `ng` instalado globalmente: se usa la CLI local con `npm run ng -w frontend -- …`.

### 11.2 Clonar e instalar dependencias

```bash
git clone https://github.com/ELopezSingh/abastos-venta.git
cd abastos-venta
npm install
```

`npm install` instala los tres workspaces y, por el `postinstall` del backend, genera el cliente de Prisma. Funciona aunque todavía no exista el `.env`.

### 11.3 Crear la base de datos local

Hay dos opciones:

- **Base vacía**: en pgAdmin, clic derecho en *Databases* → *Create* → *Database…* (por ejemplo, `abastos`).
- **Copia de producción** (recomendada para probar cambios con datos reales): crea una base nueva y restaura en ella un respaldo con clic derecho → *Restore…*. Cómo sacar el respaldo: [sección 15.4](#154-respaldo-de-la-base-de-producción).

### 11.4 Variables de entorno

```bash
# macOS / Linux
cp backend/.env.example backend/.env
# Windows (cmd)
copy backend\.env.example backend\.env
```

Edita `backend/.env`:

| Variable | Obligatoria | Default | Descripción |
|---|---|---|---|
| `DATABASE_URL` | Sí | — | Cadena de conexión de PostgreSQL, por ejemplo `postgresql://<usuario>:<contraseña>@localhost:5432/abastos`. Para bases remotas suele llevar `?sslmode=require`. |
| `PORT` | No | `3000` | Puerto de la API. |
| `CORS_ORIGIN` | No | `http://localhost:4200` | Origen permitido. En local casi no importa porque se usa el proxy. |
| `NODE_ENV` | No | `development` | **No la pongas en `production` en local**: la cookie saldría `Secure` y el navegador la rechazaría en `http://`. |

El `.env` nunca se sube al repositorio, y la cadena de conexión real no se comparte en chats ni documentos.

### 11.5 Aplicar las migraciones y generar el cliente

```bash
npm run db:deploy -w backend     # aplica las migraciones que ya vienen en el repo
npm run db:generate -w backend   # regenera el cliente de Prisma
```

> En Prisma 7, `migrate deploy` **no** regenera el cliente. Después de aplicar migraciones corre siempre `npm run db:generate -w backend`.

Si vas a **cambiar el schema**, crea la migración sin aplicarla, revisa el SQL y luego aplícala:

```bash
cd backend
npx prisma migrate dev --create-only --name <nombre_del_cambio>
# revisar prisma/migrations/<fecha>_<nombre>/migration.sql
npx prisma migrate dev
```

Si la migración toca tablas con datos, se escribe o ajusta a mano para conservarlos, y se prueba primero en una copia restaurada de producción.

### 11.6 Crear el usuario para entrar

```bash
npm run usuario:crear -w backend
```

### 11.7 Levantar en desarrollo

```bash
npm run dev
```

Esto compila `shared` y levanta en paralelo (con `concurrently`) la API en `http://localhost:3000` (con `tsx watch`) y Angular en `http://localhost:4200` (con proxy de `/api`).

Abre `http://localhost:4200`: debe aparecer el login.

> Si cambias algo en `shared/`, recompílalo con `npm run build:shared`, o deja corriendo `npm run watch -w @abastos/shared`. Si el frontend no toma el cambio, borra `frontend/.angular/cache`.
> `npm run dev` **no revisa los tipos** del backend. Antes de hacer commit corre `npm run build -w backend`.
> En desarrollo el service worker está **desactivado**. Para probar la PWA y el modo sin conexión usa el build de producción (abajo).

### 11.8 Probar el build de producción y la PWA en local

Necesitas dos terminales, ambas en la raíz.

**Terminal 1: API**

```bash
npm run dev
```

**Terminal 2: build y servidor de prueba**

```bash
npm run build:shared
npm run ng -w frontend -- build
npx http-server frontend/dist/frontend/browser -p 8080 -c-1 --proxy http://localhost:3000
```

En el navegador:

1. Si tienes sesión en `localhost:4200`, sal primero: las cookies **no distinguen puerto**.
2. Abre `http://localhost:8080/` (la raíz, no una ruta interna).
3. DevTools → Application → Storage → **Clear site data**, y recarga.
4. Para simular sin red: DevTools → Network → **Offline**.

Cada cambio del frontend requiere detener `http-server` (`Ctrl + C`), repetir el build y volver a levantarlo.

### 11.9 Verificaciones rápidas

```bash
npm test -w shared                   # pruebas de las reglas de negocio
npm run build -w backend             # tipos del backend (prisma generate + tsc)
npm run typecheck                    # compila shared y revisa tipos del backend
npm run test -w frontend             # pruebas de Angular (si aplica)
npm run db:studio -w backend         # ver los datos en Prisma Studio
```

### 11.10 Generar el APK de Android

```bash
npm run build:shared
npm run build:android -w frontend    # build con la configuración android + npx cap sync android
npm run android -w frontend          # abre el proyecto en Android Studio
```

En Android Studio, genera el APK desde *Build* → *Build App Bundle(s) / APK(s)* → *Build APK(s)* e instálalo en el dispositivo. El APK apunta a la URL de producción definida en `frontend/src/environments/environment.android.ts`.

---

## 12. Scripts disponibles

### Raíz

| Comando | Qué hace |
|---|---|
| `npm run dev` | Compila `shared` y levanta API + frontend. |
| `npm run dev:api` | Solo la API. |
| `npm run dev:web` | Solo Angular. |
| `npm run build` | Compila `shared`, `backend` y `frontend` (es el build de Railway). |
| `npm run build:shared` | Compila `@abastos/shared`. |
| `npm run typecheck` | Compila `shared` y revisa tipos del backend. |

### Shared (`-w @abastos/shared` o `-w shared`)

| Comando | Qué hace |
|---|---|
| `build` | `tsc` |
| `watch` | `tsc --watch` |
| `test` | `vitest run` (pruebas de `shared/test`) |

### Backend (`-w backend`)

| Comando | Qué hace |
|---|---|
| `dev` | `tsx watch src/server.ts` |
| `build` | `prisma generate` + `tsc` |
| `start` | `node dist/server.js` |
| `typecheck` | `tsc --noEmit` |
| `db:generate` | `prisma generate` |
| `db:migrate` | `prisma migrate dev` (crea y aplica migraciones) |
| `db:deploy` | `prisma migrate deploy` (solo aplica; es el pre-deploy de Railway) |
| `db:studio` | `prisma studio` |
| `usuario:crear` | Crea el usuario o cambia su contraseña |
| `postinstall` | `prisma generate` |

Scripts de verificación (desde `backend/`, contra la base **local**):

| Comando | Qué hace |
|---|---|
| `npx tsx scripts/foto-calculos.ts <archivo.json>` | Guarda en JSON resúmenes, vales, liquidaciones y trailers para comparar dos versiones del código. |
| `npx tsx scripts/probar-escrituras.ts` | Prueba todas las funciones `aplicar…` y **revierte** todo al final. |
| `npx tsx scripts/probar-sync.ts` | Prueba `/api/sync` y el snapshot, y **borra** sus datos de prueba al final. |

### Frontend (`-w frontend`)

| Comando | Qué hace |
|---|---|
| `start` | `ng serve` con `proxy.conf.json` |
| `build` | Build de producción en `frontend/dist/frontend/browser` |
| `watch` | Build de desarrollo en modo watch |
| `test` | `ng test` |
| `build:android` | Build con la configuración `android` y `npx cap sync android` |
| `android` | Abre el proyecto nativo en Android Studio |
| `ng -- <args>` | CLI de Angular local (ej. `npm run ng -w frontend -- g c nombre`) |

---

## 13. Pruebas

### Pruebas automáticas (shared)

```bash
npm test -w shared
```

Cubren la aritmética en centavos (incluido el redondeo de la comisión), la venta (`prepararTicket`), el folio, la cancelación, las correcciones al manifiesto, la liquidación, el resumen del día y los esquemas de las operaciones de sincronización. Si cambias una regla de negocio, agrega o ajusta su prueba.

### Pruebas automáticas (frontend)

```bash
npm run test -w frontend
```

Cubren `haceCuanto`, `describirOperacion`, el interceptor de reintento ante 503 y el componente principal.

### Scripts de verificación del backend

Se corren desde `backend/` contra la base **local** (de preferencia una copia restaurada de producción). Nunca contra producción.

- **`probar-escrituras.ts`**: corre en una transacción todas las escrituras (alta de trailer, ventas, folio repetido, correcciones, cancelación y cierre), con ids y horas como los pondría la tablet, y al final revierte todo. Debe terminar con "Todo bien".
- **`probar-sync.ts`**: manda lotes a `sincronizar()` (aplicadas, reenviadas, rechazadas, mal formadas, lote vacío, más de 100) y revisa el snapshot. Al final borra sus datos y restaura el último contacto.
- **`foto-calculos.ts`**: para refactors que no deben cambiar nada visible. Toma una foto antes y otra después, y compáralas:

  ```powershell
  # Foto "antes", con el código sin los cambios (desde la raíz del repo)
  git stash push --include-untracked -m "cambios"
  npm run build:shared
  cd backend
  npx tsx scripts/foto-calculos.ts $env:TEMP\foto-antes.json
  cd ..
  git stash pop
  npm run build:shared

  # Foto "después" y comparación
  cd backend
  npx tsx scripts/foto-calculos.ts $env:TEMP\foto-despues.json
  git diff --no-index $env:TEMP\foto-antes.json $env:TEMP\foto-despues.json
  ```

  Si el último comando no imprime nada, no cambió ninguna lectura. Las fotos traen datos reales de clientes: bórralas al terminar y nunca las subas al repo.

### Archivos `.http` (REST Client)

En `backend/src/requests/` están `trailers.http`, `tickets.http`, `resumen.http` y `sync.http`, con un ejemplo por endpoint. Como la API exige sesión, **agrega al inicio de cada archivo** una petición de login; REST Client guarda la cookie y la manda en las siguientes:

```http
@api = http://localhost:3000/api

### Login
POST {{api}}/auth/login
Content-Type: application/json

{ "usuario": "<tu_usuario>", "contrasena": "<tu_contraseña>" }
```

No guardes una contraseña real en estos archivos dentro del repo: reemplázala por el placeholder antes de hacer commit.

### Casos manuales que conviene repetir antes de cada entrega

1. Crear un trailer sin flete ni comisión (quedan 0 y 10 %), venderle, revisar que suban las cajas vendidas, cancelar el vale y revisar que regresen.
2. Vender 3 cajas a $33.33 → total exacto de $99.99 y folio = último + 1.
3. Intentar vender más cajas de las que hay → 409 con mensaje claro.
4. Vender de un trailer cerrado → rechazado.
5. Corregir el manifiesto: editar, agregar y eliminar una línea; bajar cajas de lo vendido y eliminar una línea con ventas → rechazados.
6. Resumen del día igual al total de Vales.
7. Liquidación: comisión = % de la venta; balance = venta − gastos; imprimir sin menú.
8. Cerrados: buscar por viaje/invernadero/placa, "Ver más", reabrir.
9. Login: entrar; contraseña incorrecta 11 veces → "Demasiados intentos".
10. Sin conexión (build de producción): con sesión → datos en caché con "Mostrando datos de las…"; botones de guardar con aviso; después de salir con red → se queda en login.
11. Cambio de contraseña con `usuario:crear` → la siguiente acción regresa al login.
12. Arranque en frío: detener PostgreSQL (`Stop-Service` en PowerShell como administrador) y navegar → "El servidor está despertando…", no "Error interno". Al arrancarlo, todo vuelve a funcionar.
13. Sincronización desde la consola del navegador (con sesión): mandar un `trailer.crear` y un `ticket.crear` con `creadaEn` de ayer a `POST /api/sync` → aparecen en la app con la fecha de ayer; una venta sin existencias → `RECHAZADA` y queda en `operaciones_rechazadas`.
14. Vista de teléfono angosto (iPhone SE) en DevTools, y el APK en el dispositivo Android.
15. Solo lectura (en local, con `capturaHabilitada: false`): `/vender` y `/trailers/nuevo` llevan a Inicio y no hay botones de captura; el aviso de la tablet no aparece si nunca sincronizó y se pone amarillo después de 30 min; la pantalla Sincronización muestra las rechazadas.
16. Abrir la app con el servidor despertando (PostgreSQL detenido y luego arrancado): barra "El servidor está despertando…", sin mandar al login ni quedarse en blanco.

---

## 14. Problemas conocidos y soluciones

| Síntoma | Causa | Solución |
|---|---|---|
| Después de migrar, el código no ve los modelos nuevos | Prisma 7 no regenera el cliente al migrar | `npm run db:generate -w backend` |
| Un cambio en `shared` no se refleja | `shared` se consume compilado (`dist`) | `npm run build:shared`; si el frontend sigue igual, borrar `frontend/.angular/cache` |
| El backend compila en `npm run dev` pero falla en Railway | `tsx` no revisa tipos | Correr `npm run build -w backend` antes de cada commit |
| Primera petición tras un rato sin uso fallaba con ETIMEDOUT o 500 | El servicio de Railway duerme y la base tarda en responder al despertar | Resuelto en v1.2.0: el backend espera hasta ~20 s y, si no, responde 503 con mensaje claro |
| Login correcto pero regresa al login | `validarSesion` sin `return` en el caso normal (ya corregido) | Mantener `"noImplicitReturns": true` en `backend/tsconfig.json` y correr `npm run typecheck` |
| La cookie no se guarda en local | `NODE_ENV=production` en el `.env` local, o llamadas a `http://localhost:3000` en vez de `/api` | Quitar `NODE_ENV` del `.env` local y usar siempre rutas relativas |
| Entra sin login en `:8080` | La cookie de `:4200` vale para cualquier puerto de localhost | Salir en un puerto antes de probar el otro |
| `:8080` muestra una versión vieja | No se rehízo el build, o el service worker tenía la versión anterior | Rehacer build, Clear site data en la raíz y recargar |
| "Cannot GET /…" al recargar en `http-server` | `http-server` no tiene *fallback* de SPA | Abrir la raíz `http://localhost:8080/`. En producción Express responde `index.html` |
| El proxy de `http-server` manda mal las peticiones | Un `?` al final de la URL del proxy | Usar `--proxy http://localhost:3000` sin `?` |
| Fallos de conexión con `localhost` en Windows | Resolución `localhost` (IPv6) vs `127.0.0.1` | Usar `127.0.0.1` en el destino del proxy si ocurre |
| Un 503 al abrir la app mandaba al login | `errores-red.ts` revisaba `HttpResponse` en vez de `HttpErrorResponse`, y el arranque esperaba `/api/auth/yo` | Resuelto en v1.3.0: solo un 401 cierra la sesión y la app abre sin esperar |
| Ojo de "ver contraseña" aparece y desaparece | Es el de Edge, no el de la app | Ya se ocultó con `::-ms-reveal` y hay botón propio |
| Al editar un archivo por partes desaparece una función | Se reemplazó un bloque más grande del necesario | Revisar `git diff <archivo>` después de editar y antes del commit |

---

## 15. Despliegue, versiones y respaldos

### 15.1 Producción en Railway

- Un servicio de Node que despliega la rama **`main`** y una base PostgreSQL de Railway. La configuración está en `railway.json`:
  - Build: `npm run build` (shared + backend + frontend).
  - Pre-deploy: `npm run db:deploy -w backend` (aplica migraciones). Si falla, Railway **no** cambia la versión activa.
  - Arranque: `npm run start -w backend`. Express sirve la API y el build de Angular, con *fallback* de SPA y sin caché en `index.html`, `ngsw-worker.js`, `ngsw.json` y el manifest.
  - Healthcheck: `/api/health`.
- Variables en Railway: `DATABASE_URL` (referencia a la base de Railway) y `NODE_ENV=production`. `PORT` lo asigna Railway.
- El servicio **duerme** cuando no se usa. La primera petición al despertar tarda más; el backend espera a la base (ver [sección 6](#6-api-backend)).
- URL de producción: `https://abastos-venta-production.up.railway.app`, que es la que usa el APK.

### 15.2 Ramas y versiones

- `main`: producción. Solo recibe merges desde `develop`.
- `develop`: integración.
- `feature/<nombre>`: cada cambio, creada desde `develop`.
- Versiones con [SemVer](https://semver.org/lang/es/) y tags anotados `vX.Y.Z` sobre `main`. Cada versión se documenta en [CHANGELOG.md](CHANGELOG.md).

### 15.3 Cómo publicar una versión

**Antes**

1. En la rama `feature/…`: builds, `npm test -w shared`, `probar-escrituras` y `probar-sync` (y la foto antes/después si es un refactor).
2. Merge a `develop` y repetir los builds:
   ```bash
   git checkout develop
   git pull origin develop
   git merge --no-ff feature/<nombre> -m "Merge feature/<nombre>: <resumen>"
   npm run build -w shared
   npm test -w shared
   npm run build -w backend
   git push origin develop
   ```
3. Si hay migración: sacar un **respaldo nuevo** de producción, restaurarlo como copia local y correr ahí `npx prisma migrate deploy` (es lo que hará Railway).
4. Tomar capturas en producción del resumen del día y de 2 o 3 liquidaciones, para comparar después.
5. Elegir un horario en que el tío no esté vendiendo y avisarle.

**Despliegue**

6. Revisar que `main` no tenga commits que no estén en `develop` (`git log develop..main --oneline` debe salir vacío) y mezclar:
   ```bash
   git checkout main
   git pull origin main
   git merge --no-ff develop -m "Release vX.Y.Z: <resumen>"
   git push origin main
   ```
7. En Railway, revisar el log del pre-deploy y que el despliegue quede como **Active**.

**Después (solo lectura: no se venden vales de prueba en producción, porque un folio usado no se recupera)**

8. Comparar resumen y liquidaciones con las capturas, en la web y en el APK.
9. Revisar `/api/health` y, con sesión, `/api/sync/snapshot`.
10. Dejar que el servicio se duerma y abrir la app: no debe salir ningún error.
11. Crear el tag **después** de confirmar que todo funciona, y actualizar el CHANGELOG y la bitácora:
    ```bash
    git tag -a vX.Y.Z -m "vX.Y.Z: <resumen>"
    git push origin vX.Y.Z
    ```

**Si algo falla**

- La migración falla en el pre-deploy → la versión anterior sigue activa. Revisar el log antes de reintentar; Prisma marca la migración como fallida y hay que resolverla con `prisma migrate resolve`.
- La app nueva se comporta mal → en Railway, *Deployments* → despliegue anterior → **Rollback**. Las tablas nuevas pueden quedarse, porque el código anterior no las usa. Después se corrige en git.
- Último recurso, solo si se dañaran datos: restaurar el respaldo (se pierde lo vendido después de sacarlo).

No se cambia la rama de producción a `develop` para "probar": es el mismo servicio y la misma base, así que el riesgo es igual. Para probar en Railway antes de producción, lo correcto es un ambiente de **staging** con su propia base.

### 15.4 Respaldo de la base de producción

1. En Railway, servicio de Postgres → **Variables** → `DATABASE_PUBLIC_URL`: de ahí salen host (`…proxy.rlwy.net`), puerto, usuario, contraseña y base. Se escriben directo en pgAdmin; no se pegan en chats ni archivos del repo.
2. En pgAdmin, registrar el servidor con un nombre inconfundible (ej. `Abastos PRODUCCIÓN`).
3. Clic derecho en la base → **Backup…** → Format **Custom**, Encoding **UTF8**, nombre con fecha y hora (ej. `abastos-prod-2026-11-12-1830.backup`), guardado **fuera** del repo.
4. Confirmar "Successfully completed" y que el archivo pese más de 0 KB. Si sale "server version mismatch", en *File → Preferences → Paths → Binary paths* apuntar a un PostgreSQL igual o más nuevo que el de Railway.
5. Probar el respaldo restaurándolo en una base local y revisando el último folio.

Se puede sacar aunque el tío esté vendiendo: `pg_dump` toma una foto consistente. El archivo trae nombres de clientes y ventas: guardarlo en un lugar seguro y nunca subirlo a git.

### 15.5 Datos sensibles

Contraseñas, tokens, cadenas de conexión con credenciales y la contraseña del usuario de la app nunca se escriben en el código, en este documento, en la bitácora, en commits ni en chats. Se guardan en un gestor de contraseñas y en las variables de Railway.

---

## 16. Pendientes y siguientes pasos

### Plan: la tablet captura sin conexión

- [x] **Paso 1** — Reglas de negocio en `@abastos/shared` (v1.2.0).
- [x] **Paso 2** — Backend: `POST /api/sync`, `GET /api/sync/snapshot` y tolerancia al arranque en frío (v1.2.0).
- [x] **Paso 3** — Web en modo solo lectura (sin crear, vender, cerrar ni cancelar), "Última sincronización de la tablet: hace X", vista de operaciones rechazadas y reintento en el frontend ante 503 (v1.3.0).
- [ ] Cambiar `capturaHabilitada` a `false` en la web cuando el tío tenga la tablet con el APK (a más tardar con el paso 4).
- [ ] **Paso 4** — Tablet: SQLite (`@capacitor-community/sqlite`), cola de operaciones, sincronización al recuperar señal, registro de rechazadas, carga inicial con el snapshot y aviso de reloj desfasado.

Antes del paso 4 conviene tener un ambiente de **staging** en Railway, porque ese paso es el más delicado.

### Más adelante

- [ ] **Impresión de vales** (3 copias: cliente, vendedor y quien descarga). Impresora térmica por definir. La recomendación anterior (Star Micronics con PassPRNT) era para iOS; hay que revisarla para Android. Ajustes es el lugar previsto para configurarla.
- [ ] **Cuentas por cobrar / crédito a clientes** (el tío lleva una libreta aparte).
- [ ] Confirmar con el tío la definición de **ganancia neta** (hoy: ventas − costos de andén).
- [ ] Unificar `core/errores.ts` y `core/pwa/errores-red.ts` (ver nota en la sección 10).
- [ ] Revisar si sigue en pie mover producción a la cuenta definitiva de Railway.
