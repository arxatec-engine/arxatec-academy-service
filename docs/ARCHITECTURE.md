# Arquitectura — `arxatec-academy-service`

API REST de un solo proceso: Express 5 + Prisma 7 sobre PostgreSQL, TypeScript estricto, Zod en el
borde y Pino para todo lo que se escribe. Un único módulo de negocio hoy —`auth`, con los 11
endpoints del contrato— y toda la infraestructura que ese módulo necesita, sin nada de más.

Lo que **no** hay, y es deliberado (`harness/02_reglas_backend.md` §2): no hay workspaces (Academy
es B2C, las rutas son planas), no hay Redis ni colas (el correo se manda dentro de la petición),
no hay Socket.IO y no hay middlewares de plan ni de créditos.

## 1. El mapa

```text
src/
├─ server.ts              arranque HTTP + apagado ordenado por recursos "closeable"
├─ app/create_app.ts      la cadena de middlewares, en orden intencional
├─ config/                env (Zod), logger, prisma_client, email, passport
├─ constants/             http_status_codes, error_codes, endpoints, auth, prisma, messages/*
├─ generated/             cliente Prisma (no se edita)
├─ infrastructure/        email (plantillas + envío), jwt, tokens de un solo uso, password, storage
├─ middlewares/           request_id, http_logger, cors, rate_limit, auth (estricta y opcional),
│                         require_admin, require_verified_email, file_upload, local_files,
│                         error_handler
├─ modules/auth/          LOS SLICES  (features/ + shared/)
├─ modules/courses/       features/{catalog,lessons} (fases 09-10) + shared/{data,domain,policy}
├─ modules/progress/      features/{enrollment,lesson_progress,my_courses} (fase 11)
│                         + shared/{data,domain,policy}
├─ modules/comments/      features/{thread,report} (fase 12) + shared/{data,domain}
├─ modules/user/          features/{profile,account} (fase 13) + shared/{data,domain}
├─ routes/index.ts        registro central: /api/v1 + un router por módulo
├─ types/                 tipos transversales (usuario autenticado, augmentación de Express)
└─ utils/                 errors, build_http_response, authenticated_user, safe_redirect,
                         request_body

prisma/schema/            _base · enums · users · auth · courses · progress · comments
tests/integration/postgres/   PostgreSQL real: auth, progreso, comentarios y perfil/baja de cuenta
docs/                     API.md · ARCHITECTURE.md · ENV.md
```

## 2. La cadena de arranque

`createApp()` (`src/app/create_app.ts:20-38`) monta, en este orden y por este motivo:

| Orden | Pieza | Por qué ahí |
| --- | --- | --- |
| 1 | `trust proxy` | sin él, `req.ip` es la del balanceador y **todos** los límites por IP comparten cubo |
| 2 | `helmet` | cabeceras antes que cualquier respuesta |
| 3 | `requestId` | lo primero que corre de lo nuestro: todo lo demás correlaciona con su id |
| 4 | `cookieParser`, `httpLogger`, `corsHandler` | |
| 5 | `express.json` (1 MB) | **antes de los routers**: el limitador de login agrupa por IP+correo y el correo sale de `req.body` |
| 6 | `passport.initialize()` | |
| 7 | `/ping` | sonda de vida sin pasar por el router de la API |
| 8 | `/files` → `localFiles` | almacenamiento local servido por `express.static`, solo con `STORAGE_DRIVER=local` |
| 9 | `routes` | `/api/v1` + `authRouter` |
| 10 | `registerErrorHandler` | 404 y manejador global, **siempre el último** |

`server.ts` no solo arranca: registra cada recurso como *closeable* y los cierra en orden inverso
ante `SIGTERM`/`SIGINT`, con un watchdog de 10 s (`src/constants/server.ts:5`). Sin eso, un deploy
deja conexiones colgadas.

## 3. El slice vertical

La unidad de trabajo es el endpoint, no la capa. Cada action tiene sus cinco capas, su README y sus
tests:

```text
features/<feature>/<action>/
├─ domain/       <a>.schema.ts (Zod) · <a>.payload.ts · <a>.types.ts
├─ data/         <a>.repository.ts        Prisma, select explícito
├─ presentation/ <a>.service.ts (sin Express) · <a>.controller.ts (sin try/catch) · <a>.routes.ts
├─ docs/README.md
├─ test/
└─ utils/        solo si lo usa esta action
```

El orden dentro del controller es fijo —**usuario → validación → service → respuesta**— y no hay
`try/catch` en ninguno: los errores suben al manejador global, que es el único sitio donde un error
se convierte en HTTP.

Las 9 actions del módulo: `registration/register`, `email_login/login`, `session/get_me`,
`session/logout`, `password_reset/request`, `password_reset/reset`, `email_verification/verify`,
`email_verification/resend`, y las tres de `google_login` (`start`, `callback`, `exchange`).

## 4. Las cinco invariantes del módulo de auth

1. **`password_hash` no sale nunca.** Dos barreras independientes: el `select` explícito de todos
   los repositorios (`02_reglas_backend.md` §7) y la lista campo a campo de `toApiUser`
   (`src/modules/auth/shared/domain/user_mapper.ts:3-16`). La segunda existe porque la primera se
   puede ampliar por accidente. `tests/integration/postgres/auth_flow.test.ts` busca la cadena
   `password_hash` en el JSON completo de tres respuestas distintas.
2. **La base de datos manda sobre el JWT.** Cada petición autenticada lee la fila de
   `auth_sessions`; sin eso, "cerrar sesión" sería decorativo hasta el `exp` del token. Corolario
   que costó un fallo: el `exp` que se firma **no** es el `expires_at` deslizante de la fila —que
   se mueve con cada uso— sino el **tope absoluto** de la sesión (`created_at` + 180 días,
   `AuthTokenTtlSeconds.session_absolute_max`). Firmarlo con la fecha deslizante expulsaba con
   `SESSION_EXPIRED` al usuario que entra todos los días, justo el día 31, con su fila viva.
   `resolveSessionRenewal` corta el empujón en ese mismo tope, así que la fila nunca promete más
   vida que el token (contrato §3, `src/infrastructure/docs/README.md` §2).
3. **Los tokens de un solo uso viven hasheados** (SHA-256, `one_time_token.ts:11-12`). El token en
   claro solo existe en el correo. Consumirlos es un compare-and-set (`updateMany` con
   `consumed_at: null`), no un `update`: así dos peticiones simultáneas no lo canjean dos veces.
4. **Los flujos de descubrimiento de cuentas responden igual exista o no el correo.** Login (mismo
   error, y un argon2 señuelo para igualar el tiempo) y recuperación (mismo texto y un suelo de
   400 ms).
5. **El log no lleva secretos, y eso incluye la URL.** Los serializadores de `http_logger`
   escriben `{ id, method, url }` **sin query** y `{ statusCode }` **sin cabeceras**
   (`src/middlewares/http_logger.ts:33-48`): con los de pino-http por defecto, el `302` del
   callback de Google escribía en el log su cabecera `Location` con el código de canje todavía
   sin usar, y la query entrante con el `code` y el `state` de Google
   (`01_reglas_globales.md` §8.6, `src/middlewares/docs/README.md` §2).

## 5. Errores: un solo camino

`AppError(message, statusCode, meta)` (`src/utils/errors.ts:9-20`) es el único error de dominio.
`meta.code` está tipado con la unión cerrada de `ErrorCodes` (`src/constants/error_codes.ts`), así
que **un código que no esté en el catálogo no compila**: es lo que impide que un slice invente su
propio vocabulario para el frontend.

`registerErrorHandler` (`src/middlewares/error_handler.ts:159-162`) monta el 404 y el manejador
global. Traduce tres familias: `AppError` (tal cual), `ZodError` → `422` con `meta.fields` de claves
i18n, y el error de cuerpo demasiado grande de Express → `413`. Todo lo demás es `500
INTERNAL_ERROR` con el detalle **solo en el log**. Los `5xx` se loguean con `error`, los `4xx` con
`warn`.

## 6. Política de código compartido, y la deuda que queda

| Alcance | Dónde vive | Ejemplo real |
| --- | --- | --- |
| una action | `domain/` de la action | `decoy_password_hash.ts`, `resend_cooldown.ts` |
| varias actions del módulo | `modules/auth/shared/{data,domain,policy}` | `users.repository`, `session_policy` |
| transversal de verdad | `src/utils`, `src/constants`, `src/types` | `safe_redirect`, `AuthPolicy` |

Lo vigila dependency-cruiser con **cero tolerancia y sin baseline**
(`.dependency-cruiser.cjs`): prohíbe ciclos, huérfanos, importar el `data/` privado de otro módulo,
que `src/constants` dependa de runtime, que `utils` dependa de módulos y que runtime importe una
`devDependency`.

> **La deuda declarada.** `auth_tokens` es la única tabla sin repositorio compartido: siete
> consultas equivalentes viven repartidas en `registration/register`, `email_verification/{verify,
> resend}`, `password_reset/{request,reset}` y `google_login/{callback,exchange}`. Por §9.2 le
> tocaría bajar a `modules/auth/shared/data/auth_tokens.repository.ts`. No se consolidó en esta
> integración porque mover las siete obliga a reescribir los mocks —por path exacto— de cinco
> slices, y ese cambio merece su propio commit con sus gates, no ir de polizón en el montaje.
> Relacionado: los repositorios compartidos hablaban con el cliente global `prisma` y **no
> aceptaban un cliente transaccional**, que es la razón por la que `reset` duplica el `updateMany`
> de revocación dentro de su `$transaction` en vez de llamar a `revokeAllUserSessions` (perdería
> la atomicidad sin que ningún test lo notara). **La fase 13 abrió esa puerta**: las cuatro
> funciones que necesita la baja de cuenta —`revokeOtherUserSessions`, `deleteUserAuthArtifacts`,
> `deleteUserProgress` y `deleteUserComments`— aceptan un `Prisma.TransactionClient` opcional como
> último parámetro, con el cliente global por defecto. Es el patrón que puede saldar la deuda de
> `reset`, pero ese cambio sigue siendo de su propio commit.

## 7. Correo: sin cola, y con las consecuencias asumidas

El módulo manda tres correos por usuario y por vida (verificación, recuperación, aviso de cambio).
Montar Redis y BullMQ para eso sería infraestructura sin carga, así que **el envío ocurre dentro de
la petición** (decisión D-002). Las tres consecuencias, todas explícitas en el código:

- Un fallo de SMTP en el registro **no** cuesta la cuenta: se loguea con
  `SystemMessages.email_failed` y la sesión se devuelve igual.
- En `password/forgot` el envío no se espera (`void deliverPasswordResetEmail`, `request.service.ts:42`):
  esperarlo haría visible por tiempo la rama "el correo existe", que es justo lo que el endpoint
  oculta.
- En desarrollo no se manda nada: `EMAIL_TRANSPORT=log` escribe el correo en el log, que es lo que
  permite recorrer el flujo entero sin cuenta de correo.

El punto de corte para el día que haya cola está marcado en `infrastructure/email`: es el único
sitio que sabe cómo se entrega un correo.

## 8. Tests

| Tipo | Dónde | Qué mockea | Comando |
| --- | --- | --- | --- |
| unitario del slice | `src/**/test/` | cada colaborador **por su path exacto**; nunca un barril | `pnpm test` |
| integración transversal | `tests/integration/postgres/` | solo `send_email`; Prisma y migraciones son reales | `pnpm test:integration:postgres` |

620 tests unitarios en 86 suites y 44 casos de integración (la cifra se actualiza con cada fase;
la fase 08 la dejó en 321/40, la 09 en 382/49, la 10 en 433/54, la 11 en 529/71 y la 12 en
620/86). El primero de integración recorre
registro → `/me` → verificación (y segundo clic) → logout (y segundo logout) → login → intentos
fallidos indistinguibles → recuperación (existente e inexistente) → reset → comprobación de que el
reset **revocó** la sesión abierta → login con la contraseña nueva, comprobando en cada paso lo que
quedó escrito en PostgreSQL, no solo lo que devolvió el HTTP.

El segundo (`progress_flow.test.ts`, 13 casos, fase 11) recorre "Mis cursos" vacío → inscripción
dos veces → guardado del minuto → **dos guardados simultáneos** y luego veinte a la vez sobre la
misma lección → completar el curso entero → publicar una lección nueva y ver el curso volver a "en
curso" **sin perder la fecha** → desmarcar → volver a marcar → curso archivado (`403`) → lección
inexistente (`404`) → borrado de la cuenta en cascada. La carrera del `upsert` solo se puede
probar contra PostgreSQL de verdad: un mock no tiene índice único.

El tercero (`comments_flow.test.ts`, 17 casos, fase 12) recorre lista vacía (E5) → `401` sin
sesión → **`403 EMAIL_NOT_VERIFIED`** sin verificar → `201` tras verificar → respuesta del equipo
con insignia → **bajarle el rol al autor y ver la insignia desaparecer de lo ya escrito** → el
JSON del listado público **sin una sola arroba** → afiliación por organización y por
independiente → `422` al responder a una respuesta → dos reportes que dejan una fila →
`HIDDEN`/`DELETED` que se llevan el hilo entero → los tres `422` del cuerpo → el texto plano
guardado tal cual → lección en borrador (`404`) → el sexto comentario de la hora (`429`) → borrado
de la cuenta con `SetNull` en los comentarios y `Cascade` en los reportes.

Los tests de integración se escribieron con una comprobación de mutación: al desactivar la
revocación en cascada del reset y el autenticador tolerante del logout, **4 de 14 se pusieron
rojos**. Un test que no se pone rojo cuando rompes lo que dice cubrir no cubre nada.

## 9. Los gates

Los siete de `harness/07_gates.md`, en este orden y ninguno `continue-on-error`:

```bash
pnpm lint · pnpm typecheck · pnpm typecheck:tests · pnpm boundaries
pnpm test · pnpm test:integration:postgres · pnpm build
```

`pnpm prisma:generate` primero si el cliente está desfasado; los dos `typecheck` fallan en local
sin él. El más olvidado es `typecheck:tests`, porque `tsconfig.json` **excluye** `src/**/test/**`:
un test que no compila no lo detecta ningún otro gate.

`pnpm test:integration:postgres` necesita la base levantada (`docker compose up -d`) y las
migraciones aplicadas; el archivo borra sus propias filas al empezar y al terminar, así que no deja
residuos en la base de desarrollo.
