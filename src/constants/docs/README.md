# `src/constants` — el porqué

Catálogo hoja del backend: números, códigos, rutas y textos. **No importa nada de `src/`**
(`config`, `infrastructure`, `middlewares`, `modules`, `app`, `routes`) y la regla
`no-constants-to-runtime` de `.dependency-cruiser.cjs` lo hace cumplir. Que sea hoja es lo que
permite importar una constante desde un test unitario sin arrancar Prisma.

## 1. Por qué existe: cero strings sueltos

`01_reglas_globales.md` §9 lo pide en una línea y aquí tiene una consecuencia concreta: el
frontend ramifica **solo por `meta.code`** (`04_contrato_api_auth.md` §5). Si un mensaje se
escribe a mano en un service, el día que se traduzca la respuesta el frontend no se entera; si
un código se escribe a mano, un typo (`INVALID_CREDENTIAL`) pasa el lint, pasa los tests y rompe
la pantalla de login en producción. Con `ErrorCodes` (`src/constants/error_codes.ts:1`) y su tipo
derivado (`src/constants/error_codes.ts:21`), ese typo no compila.

## 2. `HttpStatusCodes` lleva código **y** mensaje

`src/constants/http_status_codes.ts:6-24` no es un mapa de números: cada entrada es
`{ code, message }`. La razón es el sobre del contrato
(`04_contrato_api_auth.md` §1), que tiene **dos** campos distintos:

- `status` → el número (`201`),
- `message` → el nombre HTTP en inglés, fijo (`"Created"`),
- `description` → el texto para humanos, en español y traducible.

`buildHttpResponse` recibe el objeto entero (`src/utils/build_http_response.ts:28-33`) para que
`status` y `message` no puedan desincronizarse: no existe forma de responder `201` con
`"OK"`.

El `satisfies Record<string, HttpStatus>` de `src/constants/http_status_codes.ts:24` valida las
entradas sin ensanchar los literales, que es lo que mantiene vivo el tipado.

## 3. Un código nuevo es un cambio de contrato

`src/constants/error_codes.ts:1-19` empezó siendo la copia de la tabla de
`04_contrato_api_auth.md` §5 **más una fila** —trece códigos, los del módulo de login— y crece
fase a fase con el reparto de `fases_backend/README.md`: la fase 08 añadió `FORBIDDEN`,
`INVALID_FILE_TYPE` y `FILE_TOO_LARGE`; la fase 09, ninguno; la fase 10, `LESSON_LOCKED`
(`:17`); la fase 11, **ninguno** — reutiliza `LESSON_LOCKED` y `NOT_FOUND`—; la fase 12,
**ninguno** — reutiliza `EMAIL_NOT_VERIFIED` (`:6`), que estaba en el archivo desde el módulo de
login **sin que lo emitiera nadie**, y `VALIDATION_ERROR` para el 422 de responder a una
respuesta. Hoy siguen siendo **diecisiete**.

Añadir un código aquí **es cambiar el contrato**, y cambiar el contrato es tocar los dos repos en
el mismo movimiento (`01_reglas_globales.md` §7). Si un slice necesita distinguir un caso nuevo,
primero se decide en el contrato — y `fases_backend/README.md` ya lo tiene decidido fase a fase
para que dos fases no inventen el mismo nombre para cosas distintas.

**`LESSON_LOCKED` lo emiten dos fases con dos textos.** En la fase 10 significa *"crea tu cuenta"*
y en la 11 *"esta lección ya no está disponible"*
(`src/constants/messages/progress.ts:9`), porque en las rutas de progreso la sesión ya es
obligatoria y el único motivo posible es que la lección o su curso hayan dejado de estar
publicados. **El código no se duplica**: el frontend ramifica por `meta.code` y pinta el
`description` que venga, que es justo lo que el §1 del contrato pide.

**`LESSON_LOCKED` es el primero que viaja con `data`.** El `403` de la lección lleva cuerpo —el
muro que pinta la pantalla— porque no lo emite el manejador global desde un `AppError`, sino el
propio controller (`src/modules/courses/features/lessons/get_detail/presentation/get_detail.controller.ts:21-33`).
El porqué está en `src/modules/courses/features/lessons/get_detail/docs/README.md` §7.

**El decimotercero: `EMAIL_ALREADY_VERIFIED`** (`src/constants/error_codes.ts:7`). No lo pedía la
tabla §5 pero sí el §4.7 del mismo contrato, literalmente: *«un correo ya verificado responde
`200` con `meta.code: "EMAIL_ALREADY_VERIFIED"`»*. Lo emiten
`src/modules/auth/features/email_verification/verify/presentation/verify.controller.ts:21` y
`src/modules/auth/features/email_verification/resend/presentation/resend.controller.ts:30`. La tabla §5 del contrato ya
recoge la fila; sin ella, el frontend solo podía distinguir el caso comparando `description`, que
es exactamente lo que el §1 prohíbe.

## 4. `messages/` está partido en tres

| Fichero | Qué contiene | Quién lo lee |
| --- | --- | --- |
| `messages/auth.ts` | los textos de los 11 endpoints de auth, agrupados por flujo | los slices de `modules/auth` |
| `messages/common.ts` | textos genéricos de HTTP (404, 422, 429, 500) | el manejador global de errores y el 404 |
| `messages/system.ts` | textos de arranque, apagado, semilla y log | `server.ts`, `env.ts`, `seed/`, `infrastructure/email` |
| `messages/files.ts` | los del almacenamiento de archivos (fase 08) | `middlewares/` e `infrastructure/storage` |
| `messages/courses.ts` | catálogo, ficha y lección (fases 09 y 10) | `modules/courses` |
| `messages/progress.ts` | inscripción, progreso y "Mis cursos" (fase 11) | `modules/progress` y el décimo rate limit |
| `messages/comments.ts` | hilos, reportes y la afiliación del autor (fase 12) | `modules/comments` y el undécimo rate limit |

El corte no es estético: `messages/common.ts` y `messages/system.ts` los usa infraestructura que
**no pertenece a ningún módulo**, mientras `messages/auth.ts` es del dominio de auth y crecerá
con él. Mezclarlos obligaría al manejador de errores a importar el vocabulario entero del login.

`AuthMessages` (`src/constants/messages/auth.ts:1`) enumera **de más a propósito**: incluye
mensajes de validación por campo, de rate limit y los asuntos y cuerpos de los tres correos
(`04_contrato_api_auth.md` §8). Los slices que vienen después solo tienen que leerlos; añadir
uno nuevo debería ser la excepción, no el trámite de cada slice.

Los mensajes de descubrimiento de cuentas están redactados para ser **indistinguibles**:
`AuthMessages.login.invalid_credentials` es el mismo texto para correo inexistente y para
contraseña incorrecta, y `AuthMessages.password_forgot.success` es el mismo exista o no el
correo (`01_reglas_globales.md` §8.2). Cualquier mensaje nuevo que distinga esos casos rompe la
regla aunque el código esté bien.

**No hay `messages/index.ts`.** El import es siempre directo
(`import { AuthMessages } from '@/constants/messages/auth'`), por la misma razón que el barril
de `config` es flaco (`02_reglas_backend.md` §8).

## 5. `endpoints.ts` guarda las dos mitades del viaje

`src/constants/endpoints.ts:9-21` (auth), `:25-29` (cursos y lecciones), `:41-51` (progreso),
`:55-64` (comentarios) y `:66-72` (perfil y cuenta) son
las rutas del backend, montadas bajo `ApiPrefix` (`src/constants/endpoints.ts:1`), y
`src/constants/endpoints.ts:78-88` son las rutas **del frontend**. Las segundas están aquí porque el backend las escribe en tres sitios: el
enlace del correo de verificación, el del correo de recuperación y el `302` del callback de
Google (`04_contrato_api_auth.md` §§8, 9-11). Están en español porque son producto, no código
(`01_reglas_globales.md` §1), y duplicarlas en cada plantilla de correo garantizaría que un día
diverjan.

`FrontendRoutes.home` es además el destino de repliegue de `sanitizeRedirect`
(`src/utils/safe_redirect.ts:33-34`).

**`UserEndpoints.account` es `'/'`, y no es un descuido** (`:70`). `DELETE /api/v1/me` no tiene
segmento propio: la cuenta **es** `/me`. El router del módulo lo monta bajo `MeRoutePrefix`
(`src/modules/user/index.ts:9-10`), así que la ruta se compone igual que las demás y no hay ningún
literal `/me` suelto en un slice.

**Los prefijos también viven aquí, y por eso un módulo puede colgar de tres.**
`CoursesRoutePrefix` (`:23`), `LessonsRoutePrefix` (`:37`) y `MeRoutePrefix` (`:39`) los usa
`modules/progress` para montar sus cinco rutas (`src/modules/progress/index.ts:10-12`): las rutas
del alumno se nombran por lo que el alumno hace, no por la tabla que escriben. `ProgressRouteParams`
(`:48-51`) existe por lo mismo que `CourseRouteParams`: el nombre del parámetro se escribe una vez
y el controller lo lee de ahí, no de un literal.

`modules/comments` hace lo mismo con dos: `LessonsRoutePrefix` (`:37`) para el hilo de una lección
y `CommentsRoutePrefix` (`:53`) para responder y reportar
(`src/modules/comments/index.ts:9-11`). **Comparte `/lessons` con `modules/progress` y no chocan**:
`/:lesson_id/comments` no se parece a `/:lesson_id/progress` ni a `/:lesson_id/complete`, y
Express prueba router por router hasta que uno responde.

**`CommentRouteParams.comment_id` es `comment_id`, no `id`** (`:63`). La fase lo escribía como
`/:id`, pero el nombre del parámetro se lee en el controller
(`req.params[CommentRouteParams.comment_id]`) y `id` a secas no dice de qué es el id en un archivo
que también maneja `lesson_id`. La ruta pública no cambia: sigue siendo
`POST /api/v1/comments/:id/replies` para quien la llama, porque el nombre del segmento es interno.

## 6. `auth.ts` son los números del contrato, no configuración

`src/constants/auth.ts:1-8` (TTL), `:10-26` (política), `:28-38` (límites de peticiones) y
`:40-42` (nombres de cookie) son
**cifras del contrato**, no del entorno: cambian cuando cambia `04_contrato_api_auth.md`, no
cuando cambia el servidor. Por eso viven aquí y no en `env`.

| Constante | Valor | De dónde sale |
| --- | --- | --- |
| `AuthTokenTtlSeconds.session_remember_me` | 30 d | §3, tabla de `remember_me` |
| `AuthTokenTtlSeconds.session_short` | 12 h | §3, `remember_me: false` |
| `AuthTokenTtlSeconds.session_absolute_max` | 180 d | §3, tope absoluto de sesión (`exp` del JWT) |
| `AuthTokenTtlSeconds.email_verification` | 24 h | §8 |
| `AuthTokenTtlSeconds.password_reset` | 1 h | §5 |
| `AuthTokenTtlSeconds.oauth_exchange_code` | 60 s | §§9-11 |
| `AuthPolicy.session_sliding_renewal_seconds` | 5 min | §3, caducidad deslizante |
| `AuthPolicy.resend_cooldown_seconds` | 45 s | §4, endpoint 8 |
| `AuthPolicy.password_min_length` | 8 | §4, endpoint 1 |
| `AuthPolicy.oauth_state_max_age_seconds` | 10 min | §§9-11, vida del `state` y de su cookie |
| `AuthRateLimits.*` | tabla completa | §6 |
| `AuthCookies.oauth_state_nonce` | `arxatec_oauth_state` | §§9-11, el nonce que ata el `state` al navegador |

`courses.ts` y `progress.ts` siguen la misma idea para sus fases: `CoursePolicy` y `CatalogPolicy`
(`src/constants/courses.ts:1-36`) llevan los topes del contenido, y `ProgressPolicy` /
`ProgressRateLimits` (`src/constants/progress.ts:1-9`), los del progreso — el tope del minuto que
acepta el reproductor y el guardado por segundo del rate limit. Ni uno solo de esos números se
escribe dentro de un slice.

Los TTL están **en segundos**, no en milisegundos ni en cadenas tipo `'30d'`: es la unidad que
piden a la vez el `exp` del JWT y los cálculos de `expires_at`, y convertir en un solo sitio
evita el clásico error de tres órdenes de magnitud.

`AuthPolicy.session_sliding_renewal_seconds` es la ventana que evita que cada `GET /auth/me` sea
un `UPDATE` (`04_contrato_api_auth.md` §3).

`AuthTokenTtlSeconds.session_absolute_max` es la **única** fuente del `exp` del JWT
(`src/infrastructure/jwt/sign_session_token.ts:30`) y del techo de la renovación deslizante
(`src/modules/auth/shared/policy/session_policy.ts:36-37,48-66`). Que las dos lean la misma
constante es lo que impide el fallo que tuvo el módulo: un token que caducaba antes que su fila.

Los límites de longitud (`full_name_max_length`, `email_max_length`, …) coinciden con las
columnas del esquema (`prisma/schema/users.prisma`): validar en Zod lo mismo que declara la base
convierte un error 500 de Postgres en un 422 con el campo señalado.
