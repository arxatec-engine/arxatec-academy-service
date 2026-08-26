# Arquitectura — Arxatec Lawyer Service (backend)

> **Para qué sirve este documento.** Es la referencia de arquitectura del backend de Arxatec,
> escrita para que una IA (o una persona) pueda **replicar estos patrones en un proyecto nuevo**
> sin que haya que explicarlos otra vez. Recoge la estructura, las convenciones, las plantillas
> de código y —sobre todo— **el porqué** de cada decisión, incluidas las que se tomaron después
> de que algo fallara.
>
> Repo descrito: `arxatec-lawyer-service`. Su gemelo frontend está en
> [`README-PLATFORM.md`](./README-PLATFORM.md).

---

## 1. Qué es

API REST monolítica pero **modular por slices verticales**: autenticación, workspaces
(multi-tenant), casos, contactos, calendario, tareas (kanban), chat interno, documentos y
almacenamiento, finanzas y facturación, notificaciones, planes y créditos de IA, pasarelas de
pago, herramientas de PDF/OCR y un **asistente jurídico con RAG**.

Corre en **un solo proceso**: API HTTP + Socket.IO + workers de BullMQ + cron, todo junto. No
hay proceso worker separado (decisión consciente; ver §12).

---

## 2. Stack

| Capa | Elección |
| --- | --- |
| Runtime | Node.js ≥ 22.12 |
| Framework | Express 5 |
| Lenguaje | TypeScript **strict**, sin `any` |
| ORM | Prisma 7 (`@prisma/adapter-pg`) sobre PostgreSQL |
| Caché / pub-sub | Redis (`ioredis`) |
| Colas | BullMQ (in-process) + `node-cron` |
| Validación | Zod |
| Logging | Pino (`pino-pretty` en dev) |
| Tiempo real | Socket.IO |
| Auth | JWT + Passport (Google OAuth20, Microsoft) |
| Tests | Jest 30 + `@swc/jest`, Supertest |
| Vectores | Qdrant + embeddings de Vertex AI |
| LLM | Groq, Google GenAI |
| Almacenamiento | AWS S3 (`@aws-sdk/*`, presigned URLs) |
| Documentos | pdf-lib, pdfmake, muhammara, mammoth, html-to-docx, tesseract.js (OCR), puppeteer |
| Pagos | MercadoPago, Polar |
| Gestor de paquetes | **pnpm** (`packageManager` fijado). Nunca `npm run`. |

---

## 3. Arquitectura: Vertical Slice + Clean

La unidad de trabajo **no es la capa, es el endpoint**. Cada acción posee su acceso a datos,
su dominio, su presentación, sus tests y su documentación.

```text
modules/<módulo>/features/<feature>/<action>/
├─ data/
│  └─ <action>.repository.ts      # Prisma. Solo persistencia.
├─ domain/
│  ├─ <action>.schema.ts          # Zod: el contrato de entrada
│  ├─ <action>.payload.ts         # tipos derivados del schema
│  └─ <action>.types.ts           # tipos locales del slice
├─ presentation/
│  ├─ <action>.controller.ts      # HTTP: auth, workspace, validación, respuesta
│  ├─ <action>.service.ts         # reglas de negocio. NO conoce Express.
│  └─ <action>.routes.ts          # Router + cadena de middlewares
├─ docs/README.md                 # el porqué (obligatorio, ver §17)
├─ test/                          # tests enfocados de ESTE slice
└─ utils/                         # helpers usados solo aquí
```

### Las cinco capas y sus responsabilidades

| Capa | Responsable de | Prohibido |
| --- | --- | --- |
| `presentation/*.controller` | leer usuario autenticado, resolver workspace, `Schema.parse`, llamar al service, construir la respuesta HTTP | lógica de negocio |
| `presentation/*.service` | reglas, orquestación, valores por defecto del dominio, `AppError` | tocar `req`/`res` |
| `presentation/*.routes` | montar el `Router` y la cadena de middlewares | cualquier lógica |
| `data/*.repository` | consultas Prisma, `select`/`include`, filtros, orden, paginación | reglas de negocio |
| `domain/*` | schemas Zod, payloads, tipos | I/O |

**Dos niveles de módulo:**

- **Módulo de dominio** — agrupa varias features: `cases/features/{manage,notes,tracking,…}`.
- **Módulo feature** — se basta solo: `notification/{create,get,delete}`.

Regla de decisión: ¿tiene submódulos relacionados? → dominio. ¿Se sostiene solo? → feature.

**Una acción, una responsabilidad.** Si un slice crece, se parte en otro slice; no se le
añaden ramas al service.

---

## 4. Estructura global

```text
src/
├─ server.ts             # arranque: HTTP + socket + workers + cron + apagado ordenado
├─ app/                  # createApp(): middlewares y montaje de routers
├─ config/               # env, logger, prisma_client, redis, socket, bullmq, email, passport, lifecycle, cli
├─ constants/            # http_status_codes, messages, endpoints, regex, uploads, llm…
├─ generated/            # cliente Prisma generado (no se edita)
├─ infrastructure/       # aws, storage, queues, cron, llm, jwt, mappers, metrics, scraping, pagos
├─ interceptors/         # clientes HTTP salientes + timeouts
├─ middlewares/          # auth, workspace, planes, rate limit, sse budget, errores, request id, métricas
├─ modules/              # LOS SLICES
├─ routes/index.ts       # registro central: /api/v1 + un router por módulo
├─ scripts/              # scripts operativos puntuales
├─ seed/                 # semillas de base de datos
├─ types/                # tipos transversales
└─ utils/                # helpers globales (errors, pagination, build_http_response…)

prisma/
├─ schema/               # esquema PARTIDO por dominio (ver §11)
└─ migrations/

config/jest/             # configs de Jest (base, integración)
tests/
├─ canary/               # canarios de la infraestructura de test del propio repo
└─ integration/postgres/ # PostgreSQL real: migraciones, locks, transacciones, constraints
docs/                    # ARCHITECTURE, API, ENV, DECISIONS, PLANTILLA_DOCS, registro/
```

### Dónde va un test

Según lo que **es**, no lo que toca:

- **Test unitario enfocado → el `test/` del propio slice.** Debe ser hermético: mockea cada
  colaborador por el especificador exacto que importa la implementación, y no toca base de
  datos, cola ni red.
- **Test de integración transversal → `/tests`, fuera de `src`.** Prisma real, migraciones
  reales, transacciones y constraints reales, cierre del pool. No pertenece a ningún slice y
  no es código de runtime. Corre solo con su comando dedicado; el `pnpm test` normal no lo
  recoge.

---

## 5. Convenciones de nombres

- **Carpetas y archivos: `snake_case`.** `get_list/`, `update_status/`, `judicial_search/`.
- **Archivos con sufijo de capa:** `create.controller.ts`, `create.service.ts`,
  `create.repository.ts`, `create.schema.ts`, `create.payload.ts`, `create.routes.ts`.
- **Verbos de acción canónicos:** `create`, `get`, `get_list`, `update`, `delete`, `archive`,
  `upsert`, `reorder`, `search`, `stream`. Usa estos antes de inventar uno.
- **Exports con nombre**, nunca por defecto.
- **Modelos, columnas y enums de Prisma en `snake_case`** — y el JSON de la API sale igual,
  por lo que el frontend adapta a `camelCase` en su capa de adaptadores.

---

## 6. Plantillas de código

### Controller

```ts
import type { Request, Response } from 'express';

import { CASES_MANAGE_MESSAGES, HttpStatusCodes } from '@/constants';
import { buildHttpResponse } from '@/utils/build_http_response';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { getWorkspaceAccess } from '@/utils/workspace_access';

import { CreateSchema } from '../domain/create.schema';
import { createService } from './create.service';

export async function createController(req: Request, res: Response): Promise<Response> {
  const authUser = await getAuthenticatedUser(req);
  const workspace = await getWorkspaceAccess(req);
  const createRequest = CreateSchema.parse(req.body);

  const result = await createService(createRequest, authUser.id, workspace.id);

  return res.status(HttpStatusCodes.CREATED.code).json(
    buildHttpResponse(
      HttpStatusCodes.CREATED.code,
      CASES_MANAGE_MESSAGES.CASE_CREATED_SUCCESSFULLY,
      req.path,
      result,
    ),
  );
}
```

Siempre en el mismo orden: **usuario → workspace → validación → service → respuesta**. Sin
`try/catch`: los errores suben al manejador global (§8).

### Service

```ts
import { AppError } from '@/utils/errors';
import { HttpStatusCodes, CASES_MANAGE_MESSAGES } from '@/constants';
import { CASE_STATUS, CASE_URGENCY } from '@/types';

import type { CreateRequest } from '../domain/create.payload';
import { createCase, findContactByIdForLawyer } from '../data/create.repository';

export async function createService(
  createRequest: CreateRequest,
  userId: string,
  workspaceId: string,
): Promise<Awaited<ReturnType<typeof createCase>>> {
  let contactId: string | undefined;

  if (createRequest.contact_id) {
    const found = await findContactByIdForLawyer(createRequest.contact_id, workspaceId);
    if (!found) {
      throw new AppError(CASES_MANAGE_MESSAGES.CONTACT_NOT_FOUND, HttpStatusCodes.FORBIDDEN.code);
    }
    contactId = found.id;
  }

  return createCase({
    ...createRequest,
    urgency: createRequest.urgency ?? CASE_URGENCY.MEDIUM,
    status: createRequest.status ?? CASE_STATUS.IN_PROGRESS,
    user_id: userId,
    workspace_id: workspaceId,
    contact: contactId,
  });
}
```

Fíjate en el reparto: **el schema deja los campos opcionales y el service aplica el valor por
defecto del dominio** (`?? CASE_URGENCY.MEDIUM`). Así el default vive en un solo sitio y el
repositorio siempre recibe un valor.

### Routes

```ts
import { Router } from 'express';
import {
  authenticateTokenJwt,
  validateWorkspaceAccess,
  attachWorkspacePlanContext,
  requireWorkspaceCaseCapacity,
} from '@/middlewares';
import { createController } from './create.controller';

export const router = Router({ mergeParams: true });

router.post(
  '/',
  authenticateTokenJwt,          // ¿quién eres?
  validateWorkspaceAccess,       // ¿perteneces a este workspace y con qué rol?
  attachWorkspacePlanContext,    // ¿qué plan tiene el workspace?
  requireWorkspaceCaseCapacity,  // ¿le queda cupo?
  createController,
);
```

`mergeParams: true` **no es opcional**: sin él, `:workspace_id` del router padre no llega al
hijo y todo el scoping multi-tenant se cae.

### Registro de rutas

Cada módulo exporta un router que monta sus slices bajo el prefijo del recurso; el registro
central pone la versión de la API:

```ts
// modules/cases/index.ts
export const casesRouter = Router();
casesRouter.use('/:workspace_id/cases/manage', createManageRouter);
casesRouter.use('/:workspace_id/cases/manage', getListManageRouter);
casesRouter.use('/:workspace_id/cases/notes',  createNoteRouter);
// …

// routes/index.ts
const API_VERSION = '/api/v1';
router.use(API_VERSION, casesRouter);
router.use(API_VERSION, documentsRouter);
```

**Todo recurso de negocio cuelga de `/:workspace_id/`.** Es el eje del multi-tenant.

---

## 7. Módulos actuales (mapa de referencia)

| Módulo | Features |
| --- | --- |
| `auth` | email_login, google_login, microsoft_login, password_reset, registration |
| `user` | browse, connections, preferences, presence, profile, sessions |
| `workspaces` | ai_usage, billing, dashboard_layout, invitations, invoice, members, slug_availability, workspace |
| `cases` | activity, assignees, entity, judicial_catalog, judicial_search, litigation, manage, notes, references, stages, summary, timeline, tracking, tracking_fields |
| `contacts` | activity, custom_field, manage, tags |
| `calendar` | events, event_files, google_calendar, outlook_calendar |
| `kanban` | spaces, folders, columns, tasks, task_* (checklist, files, links, messages, time_logs), tags, dashboard, activity |
| `chat` | channels, direct, messages, threads, reactions, pins, bookmarks, drafts, favorites, files, canvas |
| `documents` | files, folders, storage, google_drive, one_drive, documents_share, file_annotations, files_summary, files_transcription, legal_documents, document_blocks |
| `finances` | income, expense, *_files, billing, summary, dashboard, activity |
| `plan` | manager, price + `shared/{policy,data,domain}` (límites y consumo de IA) |
| `notification` | create, get, delete |
| `tools` | combine/divide/compress/lock/convert PDF, pdf_to_word, remove_metadata, compare_documents, detect_entities, build_timeline, transcribe_document, template |
| `assistant` | bounded context completo — ver §15 |
| `mercadopago`, `polar` | webhooks de pago, renovación, cancelación |

---

## 8. Contrato HTTP: sobre, errores y estados

**Un único formato de respuesta**, construido siempre con `buildHttpResponse`:

```jsonc
{
  "status": 201,
  "message": "Created",
  "description": "Case created successfully",
  "timestamp": "2026-08-20T12:00:00.000Z",
  "path": "/api/v1/ws_123/cases/manage",
  "data": { },        // opcional
  "meta": { }         // opcional (p. ej. paginación o código de límite de plan)
}
```

**Un único tipo de error de dominio:**

```ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly meta?: { code: string },
  ) { super(message); Object.setPrototypeOf(this, new.target.prototype); }
}
```

El `meta.code` es lo que permite al frontend distinguir "prohibido" de "se acabó tu plan" y
enseñar el diálogo de upgrade en vez de un toast genérico.

**Nadie hace `try/catch` en un controller.** `registerErrorHandler(app)` monta, en orden:
manejador de errores de multer → manejador global (`handleServerError`) → 404 con el mismo
sobre. Los códigos y mensajes salen de `constants/http_status_codes` y `constants/messages`;
**cero strings sueltos en el código**.

---

## 9. Bootstrap y ciclo de vida

`createApp()` monta la cadena de middlewares en este orden, y el orden es intencional:

```ts
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(requestId);        // primero: todo lo demás correlaciona con su id
app.use(requestMetrics);   // justo después: mide la cadena completa
app.use(cookieParser());
app.use(morganLogger);
app.use(corsHandler);
app.use(express.json({ limit: '1mb', verify: capturePolarRawBody }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(passport.initialize());
app.get('/ping', (_, res) => res.send('pong'));
app.use(routes);
registerErrorHandler(app);
```

> **Patrón a copiar — cuerpo crudo solo donde hace falta.** Un webhook firmado (Polar,
> Stripe…) valida los **bytes exactos**; `JSON.stringify(req.body)` puede reordenar claves o
> cambiar escapes y la firma deja de cuadrar. El `verify` de `express.json` guarda el buffer
> **únicamente para esa ruta**: retenerlo en todas las peticiones duplicaría la memoria por
> request sin que nadie lo lea.

`server.ts` arranca y, sobre todo, **apaga ordenadamente**. Cada recurso se registra como
*closeable* y se cierra en orden inverso ante `SIGTERM`/`SIGINT`:

```ts
registerCloseable('socket+http-server', () => io.close());
registerCloseable('cron',               () => stopCronJobs());
registerCloseable('file-processing-worker', () => worker.close());
registerCloseable('file-processing-queue',  () => queue.close());
registerCloseable('prisma',             () => disconnectPrisma());
registerCloseable('redis',              () => redisClient.close());
installShutdownHandlers();
```

Sin esto, un deploy deja jobs a medias y conexiones colgadas. Es de las cosas que no duelen
hasta que duelen mucho.

---

## 10. Multi-tenant: el workspace

Dos piezas, y hay que replicar las dos:

- **`validateWorkspaceAccess` (middleware):** resuelve el identificador de la URL, comprueba
  que el usuario es miembro, y **adjunta workspace y rol a la request**.
- **`getWorkspaceAccess(req)` (util):** lo que usa el controller. **Reutiliza** lo que ya dejó
  el middleware si está presente, y solo consulta si no. Evita duplicar la consulta en cada
  petición.

> **Invariante crítico: el cliente nunca ve el UUID interno del workspace.** La URL lleva un
> identificador público (slug o id público) y `resolveWorkspaceByIdentifier` traduce al id
> interno en el borde. Si esa traducción se olvida en un punto —típicamente en el socket o en
> las notificaciones—, el sistema no falla con un error: **se queda mudo**, que es mucho peor
> de diagnosticar.

Sobre esa base se apilan los middlewares de plan: `attachWorkspacePlanContext` carga el plan y
`requireWorkspace<X>Capacity` corta con 403 + `meta.code` cuando se agota el cupo. La política
en sí es una **función pura** en `modules/plan/shared/policy`, testeable sin Express:

```ts
export function assertCasesLimit({ currentCases, casesLimit }: AssertCasesLimitInput): void {
  if (casesLimit < 0) return;                       // ilimitado
  if (currentCases >= casesLimit) {
    throw new AppError(PLANS_MIDDLEWARE_MESSAGES.CASES_LIMIT_REACHED_ERROR, HttpStatusCodes.FORBIDDEN.code);
  }
}
```

El consumo de IA se registra con `recordAiUsage` en `modules/plan/shared/data`: transacción
serializable con **reintentos ante conflicto** (`P2034`), cálculo de coste desde una tabla de
precios por modelo, y ledger de créditos. Patrón general: **la facturación de la IA se cobra
en el mismo sitio donde se consume, dentro de una transacción.**

---

## 11. Prisma y la base de datos

- **Esquema partido por dominio** en `prisma/schema/`: `_base.prisma` (generator + datasource),
  `users`, `workspaces`, `cases`, `case_tracking`, `contacts`, `calendar`, `tasks`, `chat`,
  `files`, `finances`, `billing`, `assistant`, `activity_log` y **`enums.prisma`**.
- **TODOS los enums viven en `enums.prisma`, sin excepción**, organizados por secciones con
  cabeceras de comentario. La alternativa ("cada enum junto a su modelo") suena mejor y
  funciona peor: un enum se comparte entre dominios casi siempre, y buscarlo por seis archivos
  cuesta más que desplazarse por uno.
- El cliente se genera a `src/generated` (`moduleFormat: cjs`) y **no se edita**.
- La configuración vive en `prisma.config.ts` (Prisma 7): `schema: 'prisma/schema'`,
  `migrations.path`, `datasource.url` desde el entorno.

**Patrón para catálogos externos** (ejemplo: seguimiento de expedientes judiciales): se guarda
**el dato crudo del proveedor y el resuelto de Arxatec** en columnas distintas. El `enum` es el
vocabulario de Arxatec; la tabla de catálogo es el vocabulario del tercero. Cuando el
proveedor cambia una etiqueta, no hay que migrar datos históricos.

**Auditoría transversal:** una sola tabla (`workspace_activity_log`) recoge la actividad de
casos, tareas y contactos. Añadir un módulo al log es enchufarlo, no diseñar otro log.

---

## 12. Colas, workers y cron

`infrastructure/queues/<nombre>/`, y cada cola con la misma anatomía:

```text
core/{queue,worker,repository}/    constants/   services/   utils/   types/   test/
```

Hoy: `file_processing` (extracción, OCR, transcripción, ingesta vectorial),
`case_summary` y `research_run`.

> **Decisión explícita: los workers y el cron corren dentro del proceso de la API.** No hay
> `worker.ts` separado. Es simple y suficiente a esta escala, pero tiene consecuencias que hay
> que conocer antes de replicarlo: un job pesado compite por el event loop con las peticiones,
> y escalar la API replica también los workers. Si se separa algún día, el punto de corte ya
> está preparado: `initXWorker()` en `server.ts`.

**Presupuesto de SSE.** Los endpoints que hacen streaming pasan por un middleware
(`sse_budget`) que limita streams concurrentes **por proceso** y **por workspace**
(`SSE_MAX_STREAMS_PER_INSTANCE`, `SSE_MAX_STREAMS_PER_WORKSPACE`). Sin ese tope, un puñado de
clientes reconectando agota los sockets del proceso.

---

## 13. Tiempo real

`config/socket` inicializa Socket.IO con CORS restringido al frontend y **autenticación
blanda** en el handshake:

```ts
io.use((socket, next) => {
  const token = extractHandshakeToken(socket.handshake.auth, socket.handshake.headers.authorization);
  try { if (token && JWT_SECRET) { /* verify → socket.data.userId */ } } catch { /* sigue anónimo */ }
  next();   // NUNCA se rechaza la conexión
});
```

Por qué blanda: hay salas heredadas que no requieren identidad. Los handlers que sí la
necesitan (chat, presencia) **exigen `socket.data.userId` explícitamente**. Si empiezas de
cero, prefiere auth dura; si heredas salas anónimas, este es el patrón que evita romperlas.

Cada módulo con tiempo real registra sus handlers en el arranque
(`registerChatRealtime()`, `registerPresenceRealtime()`) y define sus eventos en
`modules/<m>/shared/realtime`.

**Presencia — un patrón que merece copiarse:** el estado se parte en dos almacenes.
**PostgreSQL** guarda el estado *manual* (disponible / ocupado / ausente / invisible) y
**Redis** guarda la *conexión real* (qué sockets hay vivos). La presencia efectiva se calcula
combinando ambos: los estados sticky ganan sobre la conexión, y `offline` es el modo
invisible. Meter las dos cosas en una sola columna hace imposible distinguir "se desconectó"
de "quiere aparecer desconectado".

---

## 14. Reglas de imports (aprendidas a base de romper Jest)

El alias `@/` → `src/*` está cableado en cuatro sitios y los cuatro hacen falta:
`tsconfig.paths` (compilación), `tsc-alias` en el build (reescribe `dist/`), `moduleNameMapper`
en la config de Jest (tests) y `tsx` en dev (nativo).

**Regla: import directo del submódulo, nunca del barril global.**

```ts
// ❌
import { AppError, Pagination, sendEmail } from '@/utils';

// ✅
import { AppError } from '@/utils/errors';
import { Pagination } from '@/utils/pagination';
import { buildHttpResponse } from '@/utils/build_http_response';
import { assertCasesLimit } from '@/modules/plan/shared/policy';
```

El motivo no es estético. `utils/index.ts` exporta cosas como `invoice`, que arrastra
dependencias **ESM-only**; importar el barril en un test que solo quería `AppError` reventaba
Jest con `SyntaxError: Unexpected token 'export'`.

Corolario aplicado a los barriles de configuración: **`src/config/index.ts` es
deliberadamente flaco** — solo reexporta `env` y `logger`. `prisma_client`, `redis`, `socket`,
`bullmq`, `email` y `passport` se importan por su ruta directa. Importar una constante **no
puede** arrancar Prisma, Redis o nodemailer.

Las fronteras entre módulos se verifican con **dependency-cruiser** (`pnpm boundaries`), con
**cero tolerancia**: no hay baseline. Hubo una con 15 violaciones preexistentes; se arreglaron
todas y se eliminó. No se reintroduce para silenciar una violación — se arregla el código.

---

## 15. Política de código compartido

Orden de decisión al crear o mover un type, schema o helper:

1. Se usa en **una** action → vive en el `domain/` de esa action.
2. Se usa en **varias actions/features del mismo módulo** → `modules/<m>/shared/{domain,data,policy,…}`.
3. **Cruza módulos** → superficie global (`src/types`, `src/utils`, `src/constants`) **solo si
   es genuinamente transversal**. No existe —ni debe existir— un `src/shared/` genérico.
4. **La lógica de negocio de un dominio no va a `utils`.** Pertenece a su módulo (los límites
   de plan y el consumo de IA viven en `modules/plan/shared`, no en `utils/`).
5. **Barriles globales sin efectos secundarios:** prohibido añadir entradas que instancien
   clientes o carguen dependencias pesadas/ESM-only en tiempo de import.
6. **El `data/` privado de otro módulo NUNCA se importa.** La superficie sancionada entre
   módulos es `modules/<m>/shared/`, y dependency-cruiser lo hace cumplir.
7. **Re-export temporal de compatibilidad:** permitido solo con un comentario que diga dónde
   vive la casa real y que es temporal.
8. **La infraestructura no finge ser un util:** clientes, HTTP y colas viven en
   `infrastructure/`, `config/`, `interceptors/` o `middlewares/`.

| Pieza | Dónde va |
| --- | --- |
| Payload / schema / response de una action | `features/<f>/<action>/domain/` |
| Type usado por varias features del módulo | `modules/<m>/shared/domain/` |
| Helper puro global (paginación, respuesta, errores) | `src/utils/<name>/` |
| Helper transversal con Prisma (usuario autenticado, acceso a workspace) | `src/utils/<name>/` — excepción documentada, tiene efecto secundario |
| Facturación / precios de IA | `modules/plan/shared/{data,domain}` |
| Límites de plan | `modules/plan/shared/policy` |
| Fachada de un módulo para otros módulos | `modules/<m>/shared/data/*.repository.ts` |
| Cliente HTTP saliente + timeouts | `src/interceptors` |

---

## 16. El bounded context del asistente (patrón para subsistemas grandes)

Cuando un módulo deja de caber en `features/`, deja de ser un módulo y pasa a ser un
**bounded context** con estructura propia. Este es el patrón:

```text
modules/assistant/
├─ features/        HTTP: 12 features, 43 slices (la única entrada por red)
├─ facade/          la ÚNICA puerta pública del contexto para otros módulos
├─ engine/          lógica PURA del turno de chat — sin I/O, todo por puertos   [PRIVADO]
├─ research/        lógica PURA del deep research                                [PRIVADO]
├─ workers/         escritura: ingesta, detección, resúmenes                     [PRIVADO]
├─ vector_storage/  Qdrant y embeddings                                          [PRIVADO]
├─ contracts/       el contrato SSE congelado (schemas zod + fixtures)
└─ shared/          compartido dentro del contexto
```

Las tres ideas transferibles:

1. **Una sola puerta pública (`facade/`).** Ningún módulo de fuera importa `engine/`,
   `workers/` ni `vector_storage/`. Si algo de fuera lo necesita, se expone en la fachada —
   lo que obliga a pensar el contrato en vez de tirar de un import.
2. **El núcleo es puro.** `engine/` y `research/` no hacen I/O: reciben **puertos** (interfaces)
   y los adaptadores concretos se inyectan desde fuera. Eso es lo que hace testeable un
   pipeline de RAG sin levantar Qdrant.
3. **Los contratos de cable se congelan y se guardan con tests.**

### El contrato SSE congelado

El streaming del asistente es **byte-compatible** con lo que el frontend ya parsea: 10
eventos en orden fijo, `done` siempre lleva `[DONE]` y **siempre** termina el stream (incluso
tras un `error`, incluso al abortar), heartbeat `: ping` cada 20 s, y ciertos eventos internos
(`usage`, `tool_usage`) **nunca llegan al cable**.

Vive en `contracts/` (schemas Zod + *fixtures* de turnos de ejemplo) y está **guardado por
tests que corren en cada `pnpm test`**. Si cambias el nombre de un evento, su orden o su
payload, se ponen rojos: **eso es el gate funcionando, no un flake que esquivar.** Cambiar el
contrato significa cambiar el frontend en el mismo movimiento. Nunca se "arregla" un fixture
para que pase un test.

La fuente canónica del contrato **es el código** (los schemas), no un `.md`.

---

## 17. Documentación: el README manda, el comentario no

Esta es la convención más particular del repo, y es deliberada.

**El código fuente no lleva comentarios.** Todo lo que un comentario explicaría —el porqué de
una decisión, la trampa que evita un `if`, la cifra que salió de una medición, la divergencia
respecto a otra implementación— vive en el **`docs/README.md` de esa unidad de código**.

El motivo no es estético: un comentario solo se lee si alguien abre ese archivo, no se puede
enlazar, no cabe un diagrama y **nadie lo revisa cuando el código de al lado cambia**. Un
README sí: es la puerta de entrada de la carpeta y el diff lo pone delante del revisor.

**No es documentar menos, es al revés:** el contexto que hoy se pierde en tres líneas de `//`
pasa a ser un apartado con su tabla, su commit y su motivo. Si un comentario no merece un
párrafo en el README, tampoco merecía estar en el código.

### Las cuatro excepciones (cerradas, y siempre de una línea)

| # | Caso | Por qué se queda en el código |
| --- | --- | --- |
| 1 | Justificación de un `eslint-disable` | el lector necesita el motivo en el punto exacto donde se salta la regla |
| 2 | Justificación de un `@ts-expect-error` | sin el motivo al lado, el siguiente lo borra o lo amplía a ciegas |
| 3 | Re-export temporal de compatibilidad | debe decir dónde vive la casa real y que es temporal |
| 4 | Trampa que muerde **en esa línea** | solo si el error se comete al editar *esa* línea y el README llegaría tarde |

**No** son excepciones: separadores de sección, bloques JSDoc de prosa, `TODO`/`FIXME` (eso es
un registro o un issue) y el comentario que repite el nombre de la función. **No es un
comentario** el texto dentro de un string: prompts de LLM, SQL en template literals,
plantillas, mensajes de log — aunque contengan `//`.

### Dónde vive

Siempre `docs/README.md` **dentro** de la carpeta que documenta:

| Unidad | Ruta | Contenido |
| --- | --- | --- |
| Módulo | `modules/<m>/docs/README.md` | mapa: subsistemas, tabla de features, flujos, invariantes |
| Feature | `modules/<m>/features/<f>/docs/README.md` | tabla de actions con su endpoint, modelo común, reglas compartidas |
| Action | `.../<action>/docs/README.md` | el flujo: entrada → validación → service → repositorio → respuesta |
| Subsistema | `<dir>/docs/README.md` | `engine/`, `workers/`, `vector_storage/`, `contracts/`… |

Dos reglas prácticas: **toda carpeta con `presentation/` lleva README** (tiene endpoint, luego
tiene contrato), y **toda carpeta cuyo código habría llevado un bloque de comentarios lleva
README** (bloque = 3+ líneas seguidas, o dos comentarios en el mismo archivo).

### Se mantiene en el mismo commit

1. Tocas el código de un slice → tocas su README **en el mismo commit**. Si el cambio no altera
   nada de lo que el README afirma, dilo en el mensaje: que sea una decisión, no un olvido.
2. Slice nuevo → **nace con su README**. Un slice sin README no está terminado, igual que no lo
   está sin tests.
3. Borras un comentario → su contenido aparece en el README **o se descarta a propósito**.

### Antes de tocar código: léelo — y no te fíes de él

Las dos mitades son obligatorias y solo parecen contradecirse.

**Leerlo es obligatorio:** es la **única** copia del porqué. Cambiar código sin haberlo leído
es como se deshacen decisiones que costaron una tarde de calibración, y ya no hay un `//` al
lado de la línea que te avise.

**Fiarte de él está prohibido:** el README describe el código del momento en que se escribió, y
el código siguió. Cada afirmación en la que vayas a apoyar una decisión se comprueba contra el
código antes de usarla. Y aquí la obligación de comprobar es **más fuerte** que en un repo
normal, no igual: cuando el porqué vivía en comentarios, un README viejo era molesto pero el
código llevaba su propia red. Ahora el README es la única copia — uno que miente no es
documentación vieja: es la única fuente del contexto, mintiendo.

Por eso **cada afirmación no evidente cita `archivo:línea`**: para que comprobarla cueste diez
segundos y no haya excusa para saltárselo.

En la práctica: (1) lee el README entero; (2) comprueba **lo que vas a usar**; (3) lo que no
cuadre, corrígelo en tu mismo commit; (4) si el desfase es grande, además va al registro.

### El registro de sesión

Todo hallazgo, auditoría, comparación con un proveedor externo o decisión con consecuencias va
a `docs/registro/<YYYY-MM-DD>/<TEMA>.md`. Cuatro reglas:

1. Documento nuevo = **carpeta nueva**, con la fecha **leída del sistema con `date +%F`**,
   nunca de memoria. (Una vez se creó una carpeta con dos días de desfase y acabó arrastrado a
   47 archivos entre cabeceras, filas de índice y enlaces cruzados. Ningún gate lo detecta: un
   `.md` mal fechado compila igual, y la fecha es el único dato que no se puede reconstruir
   después.)
2. Cambio sobre un registro existente = fila nueva en su *Registro de cambios*, en **su**
   carpeta.
3. **Cabecera obligatoria** con fecha, commit verificado y método. Sin commit, un registro es
   una opinión. Si el hallazgo toca el contrato con el frontend, se declaran **los dos** commits.
4. Nunca asumas que la documentación está actualizada.

**Documentación viva** (`ARCHITECTURE.md`, `API.md`, `ENV.md`, `DECISIONS.md`, READMEs de
slice) → **se reescribe**. **Registro** → **se acumula**.

---

## 18. Testing

**Qué priorizar,** en este orden: (1) tests de service, (2) tests de controller, (3) tests de
repositorio **solo cuando la forma de la query importa**.

Un test de **service** valida: llamadas al repositorio y sus argumentos, reglas de negocio,
valores por defecto, ramas, casos de `AppError` y propagación de fallos.

Un test de **controller** valida: parseo de Zod, llamadas de autenticación y acceso a
workspace, invocación del service con datos ya validados, código HTTP, `buildHttpResponse` y
propagación de errores.

Un test de **repositorio** se añade cuando hay `select`/`include` anidados, filtros
condicionales, scoping por workspace, paginación, orden, filtros de archivado o restricciones
sensibles a seguridad. **Nunca solo para subir cobertura.**

### La regla de oro de los mocks

**Mockea el path exacto que importa la implementación.**

```ts
// implementación
import { sendEmail } from '@/utils/email_sender';

// test  ✅
jest.mock('@/utils/email_sender', () => ({ sendEmail: jest.fn() }));

// test  ❌ (mockea el barril: carga utilidades no relacionadas y rompe Jest)
jest.mock('@/utils', () => ({ sendEmail: jest.fn() }));
```

Nada de `jest.requireActual('@/utils')`; `requireActual` solo contra módulos directos y solo
si es imprescindible.

### Tipos en tests

Sin `any`; `jest.mocked(fn)` para los mocks; `unknown` solo cuando no hay alternativa; los
**fixtures respetan el contrato real de TypeScript** y no inventan campos ni añaden los que
existen en Prisma pero no en el tipo destino; nada de `undefined` para esquivar un campo
requerido. Si un tipo de retorno de Prisma es demasiado ancho, **reduce el `select` del
repositorio** en vez de forzar un fixture enorme.

---

## 19. Los gates

Se enumeran **en un solo sitio** del repo, y todo lo demás enlaza ahí en vez de mantener su
propia copia (dos copias divergieron una vez). CI los invoca en este orden y **ninguno es
`continue-on-error`**:

```bash
pnpm lint                       # eslint src/
pnpm typecheck                  # tsc --noEmit
pnpm typecheck:tests            # los tests se tipan aparte
pnpm boundaries                 # depcruise src (fronteras entre módulos)
pnpm test                       # jest --runInBand
pnpm test:integration:postgres  # PostgreSQL real
pnpm build                      # tsc && tsc-alias
```

Dos apuntes que valen como lección general:

- `typecheck` y `typecheck:tests` **fallan en local si el cliente Prisma está desfasado**:
  `pnpm prisma:generate` primero.
- **El gate más olvidado es `typecheck:tests`**, y saltárselo es exactamente cómo CI se pone
  rojo tras una corrida local verde.
- Un gate listado en CI **no es prueba de que se ejecute**. En este repo, dos de los siete
  llegaron a estar rotos —la config de dependency-cruiser borrada, el script de integración
  inexistente— mientras el paso seguía en el workflow. **Verifica ejecutándolos**, y si uno
  está roto, documenta el estado en vez de inventar una config nueva para taparlo.

Para iterar (no sustituye a los gates): `pnpm test path/to/file.test.ts`,
`pnpm test modules/cases`.

---

## 20. Entorno e infraestructura local

`docker-compose.yml` levanta PostgreSQL (`5443:5432`) y Qdrant (`6343:6333`) con volúmenes
persistentes y healthcheck. Redis se espera aparte.

Variables agrupadas por bloque en `docs/ENV.md`: servidor, base de datos, Redis, JWT, cifrado
de tokens OAuth (AES-256-GCM), AWS, email, frontend, Google/Microsoft OAuth, OneDrive, LLM,
Qdrant (dos planos: producto y corpus legal), Vertex AI, pagos, investigación, Chromium.

Detalles del patrón de configuración:

```ts
config({ path: '.env', override: true });
export const PORT = Number(process.env.PORT || 3001);   // `||`, no `??`: un PORT= vacío también cae al default
export const METRICS_ENABLED =
  process.env.METRICS_ENABLED === 'true'  ? true
  : process.env.METRICS_ENABLED === 'false' ? false
  : ENVIRONMENT !== 'production';                        // por defecto: on fuera de producción
```

> **Trampa real que cuesta una hora:** `dotenv` con `override: true` hace que el `.env` **gane
> sobre las variables de entorno reales**. Un `DATABASE_URL=... pnpm dev` como prefijo **no
> cambia de base de datos**: el `.env` lo pisa. Si copias este patrón, sábelo; si no lo
> quieres, quita el `override`.

Las métricas por petición (log con desglose por tramo + cabecera `Server-Timing`) van
**apagadas en producción salvo que se pidan a mano** — que es justo lo que permite diagnosticar
un incidente sin desplegar.

---

## 21. Receta: slice nuevo de cero

1. Decide **módulo** (¿existe?) y **feature** (¿existe?). Luego el nombre de la **action** del
   vocabulario canónico (§5).
2. `domain/<action>.schema.ts` — Zod. Deja opcionales los campos con default de dominio.
3. `domain/<action>.payload.ts` — tipos derivados del schema.
4. `data/<action>.repository.ts` — Prisma, con `select` explícito y **scoping por workspace**.
5. `presentation/<action>.service.ts` — reglas, defaults, `AppError`. Sin Express.
6. `presentation/<action>.controller.ts` — usuario → workspace → parse → service → `buildHttpResponse`.
7. `presentation/<action>.routes.ts` — `Router({ mergeParams: true })` + cadena de middlewares.
8. Exporta el router en el `index.ts` de la feature y móntalo en el `index.ts` del módulo bajo
   `/:workspace_id/<recurso>/…`.
9. Mensajes y códigos → `src/constants` (cero strings sueltos).
10. `docs/README.md` del slice: flujo completo, entrada, reglas y respuesta.
11. `test/` — service + controller como mínimo, mockeando por path exacto.
12. Corre los gates.

---

## 22. Do / Don't

**Do**

- Un slice = una responsabilidad; si crece, se parte.
- Validar con Zod **en el controller**; el service recibe datos ya validados.
- Servicios independientes de `req`/`res`.
- Repositorios centrados en Prisma, con `select` explícito y scoping por workspace.
- Imports directos de submódulos.
- Constantes y mensajes centralizados.
- Pino con logs estructurados.
- `docs/README.md` actualizado en el mismo commit que el código.

**Don't**

- `any`, `@ts-ignore`, casts inseguros.
- `console.log` — **sin excepciones, incluidos los scripts**.
- Importar el `data/` privado de otro módulo.
- Dependencias circulares.
- Strings hardcodeados donde ya hay una constante.
- `eslint-disable` sin justificación y sin el ámbito más estrecho posible
  (`eslint-disable-next-line`, **nunca** a nivel de archivo). Es la vía por la que estas
  reglas se saltan en silencio: el lint sigue verde y nada te avisa.
- Reintroducir un baseline para callar a dependency-cruiser.
- Cambiar el contrato SSE sin cambiar el frontend a la vez.
- Dar por actualizada la documentación sin comprobarla.

---

## 23. Regla final

Las herramientas de IA existen para **amplificar la disciplina, no para sustituirla**.

No generes código que solo pasa en local mientras debilita la arquitectura, el tipado, la
fiabilidad de los tests o el mantenimiento a largo plazo. El código generado se revisa con el
mismo rigor que el escrito a mano — y con más sospecha, porque es más rápido de producir.
