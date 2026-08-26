# `src/middlewares` — el porqué

Once middlewares y un resolvedor compartido. Seis los monta `createApp()` en el orden exacto de
`02_reglas_backend.md` §6 (`src/app/create_app.ts:20-38`); los otros cinco
—`authenticate_token_jwt`, `optional_authenticate`, `require_admin`, `require_verified_email` y
`file_upload`— **no son globales**: los monta cada slice que los necesita en su `*.routes.ts`,
porque la mayoría de los endpoints de auth son públicos, el panel de admin es una minoría de las
rutas, solo dos endpoints de todo el producto exigen el correo verificado y solo tres reciben
archivos.

`resolve_request_session.ts` **no es un middleware**: no toca `res` ni llama a `next()`. Es la
resolución de sesión que comparten el autenticador estricto (§5) y el opcional (§10), y está aquí
porque hace I/O y vive en el borde HTTP, no en el dominio.

## 0. Por qué el orden de la cadena importa

| # | Middleware | Por qué va ahí |
| --- | --- | --- |
| 1 | `helmet()` | cabeceras de seguridad antes de cualquier respuesta, incluidas las de error |
| 2 | `requestId` | **primero de los nuestros**: todo lo que venga después correlaciona con su id |
| 3 | `cookieParser()` | antes del log, para que el log ya vea la petición completa |
| 4 | `httpLogger` | después de `requestId`, o el log no tendría con qué correlacionar |
| 5 | `corsHandler` | antes de parsear el cuerpo: un origen no permitido no merece que le leamos 1 MB |
| 6 | `express.json` / `urlencoded` | el cuerpo se parsea una vez y con límite (`ServerPolicy.json_body_limit`) |
| 7 | `passport.initialize()` | Google OAuth necesita a passport montado antes de sus rutas |
| 8 | `localFiles` bajo `/files` | sirve el almacenamiento local (`src/app/create_app.ts:33`); va **antes** de `routes` porque no es un slice y no debe atravesar sus middlewares |
| 9 | `routes` | los slices |
| 10 | `registerErrorHandler` | **el último, siempre**: 404 y manejador global cierran la cadena |

## 1. `request_id.ts` — el hilo que cose los logs

`requestId` (`src/middlewares/request_id.ts:24`) reutiliza el `x-request-id` entrante si existe y
si no genera un `randomUUID()`. La validación de la cabecera entrante
(`src/middlewares/request_id.ts:10-22`) no es paranoia decorativa: el id se escribe en la cabecera
de respuesta y en cada línea de log, así que un valor con saltos de línea o de 4 KB permitiría
inyectar líneas falsas en el log o inflarlo. Solo pasan `[A-Za-z0-9._-]` y hasta
`ServerPolicy.request_id_max_length` caracteres (`src/constants/server.ts:6`).

El id se escribe en **tres** sitios (`src/middlewares/request_id.ts:27-29`):

1. `req.request_id`, que es lo que lee el manejador global (`src/middlewares/error_handler.ts:158`);
2. `req.headers['x-request-id']`, para que `genReqId` de pino-http lo lea **sin ningún cast**
   (`src/middlewares/http_logger.ts:10-14`) — ésa es la razón concreta de normalizar la cabecera
   de entrada en vez de guardar el id solo en el objeto `Request`;
3. la cabecera de respuesta, para que el frontend pueda citar el id en un reporte de error.

## 2. `http_logger.ts` — pino-http, no `console`

`autoLogging.ignore` (`src/middlewares/http_logger.ts:28,46`) silencia `GET /ping`: es el
healthcheck del orquestador y, si se loguea, ahoga el log real con una línea cada pocos segundos.

**Los serializadores son propios y eso no es un capricho de formato** (`:33-41,47-48`). Los
serializadores por defecto de pino-http escriben `req.url` **con su query**, `req.query` entera
y **todas** las cabeceras de la respuesta. En este backend eso significaba escribir, a nivel
`info`, tres secretos vivos:

| Qué se escribía | Dónde aparecía | Por qué importa |
| --- | --- | --- |
| `res.headers.location` del `302` del callback de Google | `src/modules/auth/features/google_login/callback/presentation/callback.controller.ts:19` | lleva el **código de un solo uso**, aún sin canjear: quien lea el log tiene 60 s para hacer `POST /auth/google/exchange` y salir con la sesión de esa persona |
| `req.query.code` y `req.query.state` | `GET /auth/google/callback` | el código de autorización de Google y el state, en claro |
| `req.query.token` | enlaces de verificación y de reset si algún día llegan por query | token de un solo uso |

Eso destruía exactamente la garantía por la que el contrato §§4.9-11 inventó el código
intermedio ("un token en la URL queda … en los logs de cualquier proxy intermedio") y rompía
`01_reglas_globales.md` §8.6. Por eso el `req` que se loguea es **`{ id, method, url }` con la
ruta sin query** (`toLoggedPath`, `:30-31`) y el `res` es **`{ statusCode }`**, nada más. Lo que
se pierde no hace falta: el `request_id` ya correlaciona la línea con la petición.

`wrapSerializers: false` (`:47`) es lo que hace que estos serializadores reciban el `req`/`res`
crudos en vez de la salida de los serializadores estándar; sin él, pino-http los encadenaría y
el nuestro recibiría un objeto ya expandido.

La redacción de secretos del **cuerpo** de los logs **no está aquí**: vive en el logger base
(`src/config/logger.ts:5-26`), que borra `authorization`, `cookie`, `password`, `token` y
compañía. Ponerla en el middleware la dejaría fuera de los logs que no pasan por HTTP. Las dos
capas se complementan: los serializadores deciden **qué se escribe** de una petición HTTP, la
redacción limpia **cualquier** objeto que un `logger.info` reciba.

## 3. `cors_handler.ts` — un solo origen, normalizado

`allowedOrigin` se calcula con `new URL(env.FRONTEND_URL).origin`
(`src/middlewares/cors_handler.ts:6`) en lugar de comparar contra `env.FRONTEND_URL` a pelo: la
cabecera `Origin` **nunca** trae barra final ni path, y un `.env` con
`FRONTEND_URL=http://localhost:5173/` rompería CORS de una forma difícil de diagnosticar desde el
navegador.

`origin` sin valor se acepta (`src/middlewares/cors_handler.ts:9-11`): son las peticiones que no
son de navegador (curl, healthchecks, el propio backend). CORS no es un control de acceso —
protege al usuario en su navegador, no al servidor.

`exposedHeaders` incluye `x-request-id` y `Retry-After` (`src/constants/server.ts:12`), que si no
el frontend no puede leerlos aunque el backend los mande.

## 4. `rate_limit.ts` — una fábrica y once límites

`createRateLimiter` (`src/middlewares/rate_limit.ts:43`) recibe la definición
(`window_seconds` + `max`), la descripción y la función de clave. Los nueve límites del contrato
§6 se instancian abajo (`src/middlewares/rate_limit.ts:66-112`) leyendo **exclusivamente** de
`AuthRateLimits` (`src/constants/auth.ts:28-38`): los números no se escriben aquí. El décimo, el
de la fase 11, lee de `ProgressRateLimits` (`src/constants/progress.ts:7-9`) y sigue la misma
regla.

| Endpoint | Límite | Clave | Export |
| --- | --- | --- | --- |
| `/auth/login` | 30 / 15 min | IP | `loginByIpRateLimit` |
| `/auth/login` | 10 / 15 min | IP + correo | `loginByAccountRateLimit` |
| `/auth/register` | 5 / hora | IP | `registerRateLimit` |
| `/auth/password/forgot` | 5 / hora | IP | `passwordForgotByIpRateLimit` |
| `/auth/password/forgot` | 3 / hora | correo | `passwordForgotByEmailRateLimit` |
| `/auth/password/reset` | 20 / hora | IP | `passwordResetRateLimit` |
| `/auth/email/verify` | 20 / hora | IP | `emailVerifyRateLimit` |
| `/auth/email/resend` | 5 / hora | usuario | `emailResendRateLimit` |
| `/auth/google/exchange` | 20 / hora | IP | `googleExchangeRateLimit` |
| `PUT /lessons/:id/progress` | 1 / segundo | usuario | `lessonProgressRateLimit` |

`/auth/password/forgot` lleva **dos**, y se montan los dos en la misma ruta: el de IP frena a un
atacante que barre correos desde un equipo, el de correo frena a quien barre desde muchas IPs
contra una sola víctima. Uno solo deja abierta la otra mitad.

**`/auth/login` lleva dos por la misma razón, y antes llevaba uno.** La fila del contrato §6
dice «10 / 15 min · clave IP + correo» y estaba implementada con una sola clave **compuesta**
`${ip}|${correo}`: cada par (IP, correo) estrenaba su propio cubo, así que **no existía ningún
tope por IP** y rotar el correo daba intentos ilimitados desde una sola máquina. Es el barrido
de contraseñas (*password spraying*): probar una contraseña plausible contra 50 000 correos, que
es hoy el ataque habitual, no la fuerza bruta contra una cuenta. Ahora la ruta encadena los dos
(`src/modules/auth/features/email_login/login/presentation/login.routes.ts:9`), igual que `password_forgot`:

- `loginByIpRateLimit` (`:64-67`) — **30 / 15 min por IP**, el techo del barrido. Es más alto que
  el de cuenta a propósito: una oficina detrás de un NAT comparte IP y varias personas pueden
  equivocarse de contraseña en la misma ventana sin quedarse fuera.
- `loginByAccountRateLimit` (`:69-73`) — **10 / 15 min por (IP + correo)**, la fila literal del
  contrato, que es la que frena la fuerza bruta contra una cuenta concreta.

Los dos números están en el contrato §6 y en `AuthRateLimits.login_by_ip` /
`AuthRateLimits.login_by_account`. `src/middlewares/test/rate_limit.test.ts` fija el
comportamiento: 31 correos distintos desde una IP acaban en `429`, y 11 intentos contra el mismo
correo también.

**Por qué la clave nunca es `req.ip` a pelo.** `ipKeyGenerator`
(`src/middlewares/rate_limit.ts:41`) agrupa las IPv6 por subred /64: un atacante con un /64 tiene
2^64 direcciones y, sin agrupar, el límite por IP no limita nada.

`emailKey` (`src/middlewares/rate_limit.ts:41`) lee el correo del cuerpo con un lector defensivo
(`src/middlewares/rate_limit.ts:25-33`) porque el rate limit corre **antes** de que Zod valide:
el cuerpo puede ser cualquier cosa, incluido un `null` o un array. Normaliza a minúsculas para
que `Maria@x.pe` y `maria@x.pe` compartan cubo.

`handler` (`src/middlewares/rate_limit.ts:54-63`) no responde por su cuenta: pone `Retry-After`
y delega en el manejador global con un `AppError` `RATE_LIMITED`. Así el `429` sale con el mismo
sobre que todo lo demás, que es lo que exige `04_contrato_api_auth.md` §1.

**El décimo límite no protege una contraseña: protege la base de datos.**
`lessonProgressRateLimit` (`src/middlewares/rate_limit.ts:114-118`) cubre
`PUT /lessons/:id/progress`, que el reproductor llama cada pocos segundos por alumno. No hay
secreto que adivinar ahí; lo que hay es un bucle del cliente que puede convertir una pestaña
abierta en cientos de escrituras por segundo. Un guardado por segundo y por usuario deja pasar el
uso normal —el reproductor guarda cada varios segundos— y corta el bucle. Agrupa por `userKey`,
así que va **después** de `authenticateTokenJwt`, igual que el del reenvío
(`src/modules/progress/features/lesson_progress/update/presentation/update.routes.ts:10-15`).

**Orden obligatorio en la ruta del reenvío.** `emailResendRateLimit` agrupa por usuario
(`userKey`, `src/middlewares/rate_limit.ts:41`), así que en `/auth/email/resend` tiene que ir
**después** de `authenticateTokenJwt`: antes, `req.user` todavía no existe y el límite se
degradaría silenciosamente a la IP —dos personas en la misma oficina compartirían los 5 reenvíos
por hora—. Los demás límites van antes de cualquier autenticación, que es donde tienen que estar.

**El undécimo límite protege la reputación del producto.** `commentRateLimit`
(`src/middlewares/rate_limit.ts:120-124`) cubre las **dos** rutas que escriben en un hilo
—`POST /lessons/:id/comments` y `POST /comments/:id/replies`— con **la misma instancia**, y por
tanto con un solo contador: cinco por hora y por usuario entre las dos. Dos limitadores separados
serían diez, que es exactamente lo que no se quería. Un hilo de preguntas no necesita más, y sin
tope el bloque de comentarios es un buzón de spam.

Va **después** de `requireVerifiedEmail` (§7b) a propósito: un `403 EMAIL_NOT_VERIFIED` es una
petición que ni siquiera podía escribir, y no debe gastar cupo. Lo que sí gasta cupo es un `422`
—el limitador corre antes que Zod—: cinco intentos con el cuerpo vacío agotan la hora. Es el mismo
comportamiento que en login y es deliberado; el cliente no debería mandar un cuerpo vacío.

**Consecuencia conocida (D-002).** El store es en memoria: con más de una instancia, cada proceso
tiene su propio contador y los límites se multiplican por el número de procesos. En cuanto haya
una segunda instancia, esto pasa a Redis. `retry_after_seconds` es la ventana completa, no el
tiempo exacto que resta: express-rate-limit v8 ya no expone `req.rateLimit` en sus tipos, y una
espera de más es preferible a una de menos.

## 5. `authenticate_token_jwt.ts` — la pieza crítica

**Este archivo no exporta un middleware: exporta una fábrica y dos instancias.**

| Export | Origen | Deja pasar de más | Dónde está montado |
| --- | --- | --- | --- |
| `authenticateTokenJwt` (`:60`) | `createSessionAuthenticator({ allow_revoked_session: false })` | nada | todas las rutas autenticadas: `/auth/me`, `/auth/email/resend` |
| `authenticateRevocableSession` (`:62-64`) | `createSessionAuthenticator({ allow_revoked_session: true })` | una sesión **ya revocada** | **solo** `/auth/logout` (`src/modules/auth/features/session/logout/presentation/logout.routes.ts:9`) |

La variante tolerante existe por el contrato §4.3: *«Idempotente: una sesión ya revocada responde
`200`»*. Con el autenticador normal, cerrar sesión dos veces —o cerrar sesión desde dos pestañas—
daría `401 SESSION_EXPIRED` y la SPA pintaría la pantalla E7 a alguien que acaba de pulsar
"salir". Sigue exigiendo firma válida, sesión existente, dueño correcto y **`expires_at` vigente**:
lo único que se salta es la comprobación de `revoked_at`.

**La regla: `authenticateRevocableSession` solo va en `/auth/logout`.** Montarla en cualquier otra
ruta convierte un token de una sesión cerrada en una llave que sigue abriendo esa puerta, y
"cerrar sesión" deja de cerrar nada ahí. Si hace falta una tercera instancia, sale de la misma
fábrica y se anota en esta tabla.

**Desde la fase 09 la fábrica no resuelve la sesión: la traduce.** Los seis pasos de resolución
viven en `resolve_request_session.ts` (§10) y devuelven un resultado, no una excepción; esta
fábrica convierte cada motivo de rechazo en su `AppError`
(`src/middlewares/authenticate_token_jwt.ts:23-31`) y ejecuta la renovación.

Orden exacto (`src/middlewares/resolve_request_session.ts:43-82` + `authenticate_token_jwt.ts:33-58`):

1. **Bearer** (`resolve_request_session.ts:23-33`) → sin cabecera, mal formada o vacía:
   `MISSING_TOKEN` → `401 UNAUTHENTICATED`.
2. **Firma** → `readSessionToken` (`src/infrastructure/jwt/verify_session_token.ts:27`), que
   distingue el token caducado del ilegible: `TOKEN_EXPIRED` → `SESSION_EXPIRED`, `TOKEN_INVALID`
   → `UNAUTHENTICATED`.
3. **Sesión en base de datos** por `jti` (`resolve_request_session.ts:61`). **La base de datos es
   la autoridad, no el JWT** (`04_contrato_api_auth.md` §3, D-004). Sin esta consulta, "cerrar
   sesión" sería decorativo.
4. **`sub` contra `user_id`** (`:67-69`) → `UNAUTHENTICATED`. Un token cuyo dueño no coincide con
   la sesión está manipulado, no caducado.
5. **`revoked_at`** (`:73-75`) → `SESSION_EXPIRED`, **salvo** con `allow_revoked_session: true`.
6. **`expires_at`** (`:77-79`) → `SESSION_EXPIRED`, siempre, en las dos instancias.
7. **Renovación deslizante** (`authenticate_token_jwt.ts:42-53`), acotada por el tope absoluto de
   la sesión. **Solo aquí**: el autenticador opcional no la ejecuta (§10).
8. `req.user` (`authenticate_token_jwt.ts:55`) con la forma de `AuthenticatedUser`
   (`src/types/authenticated_user.ts:3`), construida en `resolve_request_session.ts:35-41`.

**Por qué `UNAUTHENTICATED` y `SESSION_EXPIRED` no son el mismo error.** El frontend pinta
pantallas distintas (`04_contrato_api_auth.md` §5): `UNAUTHENTICATED` manda a login;
`SESSION_EXPIRED` abre la pantalla E7 **conservando el destino de retorno**. Colapsarlos haría
perder el `redirect_to` a todo usuario cuya sesión venció, que es exactamente el caso en el que
el brief promete tres veces "vuelves justo aquí".

**Por qué la renovación se escribe como mucho una vez cada 5 minutos.** `resolveSessionRenewal`
(`src/modules/auth/shared/policy/session_policy.ts:48`) decide; el middleware solo obedece. Sin
ese freno, cada `GET /me` sería un `UPDATE`, y el guard `<Auth>` llama a `/me` en cada carga de
página.

**Por qué la renovación recibe `created_at`.** El `exp` del JWT se firma con el **tope absoluto**
de la sesión (`created_at` + 180 días, contrato §3), no con el `expires_at` deslizante; para que
la fila nunca prometa más vida que el token, `resolveSessionRenewal` corta el empujón en ese mismo
tope (`session_policy.ts:48-66`). Las dos fechas salen de la misma constante, así que no pueden
desincronizarse.

**Por qué no hay `try/catch`.** Express 5 reenvía las promesas rechazadas al manejador global,
así que los `throw` de aquí llegan al mismo sitio que los de cualquier service.

## 6. `error_handler.ts` — un solo camino de salida

`registerErrorHandler` (`src/middlewares/error_handler.ts:181`) monta **primero** el 404 y
**después** el manejador: en Express el 404 es "ningún router respondió", así que tiene que ser
el último `use` normal, y el manejador de errores el último de todos.

`resolveError` (`:74`) traduce siete familias:

| Entrada | Salida |
| --- | --- |
| `AppError` (`:75-81`) | su `statusCode` y su `meta` tal cual |
| `MulterError` con `LIMIT_FILE_SIZE` (`:83-89`) | `413` + **`FILE_TOO_LARGE`** |
| cualquier otro `MulterError` (`:91-97`) | `400` + `VALIDATION_ERROR` |
| `ZodError` (`:99-105`) | `422` + `VALIDATION_ERROR` + `meta.fields` |
| error de body-parser 413 (`:109-115`) | `413` + `payload_too_large` |
| otro error 4xx de body-parser (`:117-123`) | `400` + `validation_error` |
| cualquier otra cosa (`:125-129`) | `500` + `INTERNAL_ERROR`, sin filtrar el detalle |

**Los dos `413` no comparten `meta.code` a propósito.** El de body-parser (`payload_too_large`,
`VALIDATION_ERROR`) es "el JSON que mandaste pasa de 1 MB"; el de multer es "el archivo que
subiste pasa del límite de su uso", y el frontend lo pinta debajo del selector de archivo con el
tamaño máximo al lado. Distinguirlos es justo para lo que existe `meta.code`.

**`meta.fields` son CLAVES de i18n, no texto.** El contrato lo fija en §5:
`"fields": { "email": "auth.errors.email_invalid" }`. `toFieldKeys` (`:39`) toma el `message` del
issue de Zod —que los schemas rellenan con una clave de `ValidationKeys`
(`src/constants/validation_keys.ts:1-52`)— y lo deja pasar **solo si tiene forma de clave**
(`isI18nKey`, `src/constants/validation_keys.ts:56`). Si no la tiene (mensaje por defecto de Zod,
en inglés), lo sustituye por `ValidationKeys.common.invalid`. Esa red es lo que garantiza que el
frontend nunca reciba prosa inglesa donde espera una clave que traducir.

Los issues sin `path` (refinamientos de objeto completo) se agrupan bajo `ValidationRootField`
(`src/constants/validation_keys.ts:58`), que es donde el formulario pinta el error general.
El primer issue de cada campo gana (`:45-47`): pintar dos errores en el mismo input no aporta.

`readNumericStatus` (`:53`) mira `statusCode`/`status` con `in` y comprobando el tipo, sin cast
ni `any`, porque los errores de body-parser no son `AppError` pero sí traen un estado utilizable.
Solo se acepta el rango 4xx: un 5xx que venga de una librería se trata como error interno y no
se le cree el código.

**El detalle del 500 no sale nunca en la respuesta** (`:125-129` usa `CommonMessages.internal_error`),
solo al log (`:165-169`), con `request_id`, método, ruta, estado y código. Ése es el par que
permite encontrar la línea exacta a partir del id que ve el usuario.

`res.headersSent` (`:149-153`) delega en el manejador por defecto de Express: si la respuesta ya
empezó a escribirse, escribir el sobre encima produce un JSON corrupto.

## 7. `require_admin.ts` — el rol sale de la fila, no del token

`requireAdmin` (`src/middlewares/require_admin.ts:10`) corta con `403 FORBIDDEN`
(`CommonMessages.forbidden`) a todo el que no sea `ADMIN`. Va **siempre después de
`authenticateTokenJwt`**: lee `req.user` con `getAuthenticatedUser`
(`src/utils/authenticated_user.ts:9`), que responde `401 UNAUTHENTICATED` si no hay sesión. Sin
ese orden, un visitante sin token recibiría `403` en vez de `401` y la SPA le pintaría "no tienes
permiso" en lugar de mandarlo a iniciar sesión.

**El rol no se lee del JWT.** Un token puede tener horas de vida y un rol se revoca en segundos;
si `requireAdmin` mirara el claim `role` del token (que existe:
`src/infrastructure/jwt/sign_session_token.ts:29`), degradar a un admin no tendría efecto hasta
que su sesión caducara — es decir, se creería haberlo revocado sin haberlo hecho.

**Y no hace falta una consulta extra para evitarlo.** `authenticate_token_jwt` ya carga el rol
**de la fila `users`** en la misma consulta con la que valida la sesión: el `select` de
`findSessionById` incluye `user.role`
(`src/modules/auth/shared/data/sessions.repository.ts:16-21`) y ese valor es el que acaba en
`req.user.role` (`src/middlewares/resolve_request_session.ts:38` → `src/middlewares/authenticate_token_jwt.ts:55`). Así que `req.user.role` **es**
el rol de la base de datos, leído en esta misma petición, y una segunda consulta solo repetiría
lo que ya está en memoria.

> La fase 08 pedía "una consulta más si hace falta". No hace falta: el código ya la hacía. El
> documento de la fase quedó corregido en el mismo movimiento.

`src/middlewares/test/require_admin.test.ts` fija las tres ramas, y la tercera es la que sostiene
todo lo anterior: **un JWT firmado con `role: ADMIN` contra una fila que ya dice `STUDENT`
recibe `403`** (`:98-106`).

**Responde `403`, no `404`.** Aquí no hay nada que ocultar: quien llega a `/api/v1/admin/...` con
sesión de alumno sabe perfectamente que existe un panel. Ocultarlo con un `404` solo confundiría
al admin legítimo que se equivocó de cuenta.

## 8. `file_upload.ts` — el tope va en el borde

`createFileUpload(usage)` (`src/middlewares/file_upload.ts:12`) devuelve un multer con
`memoryStorage()` y **`limits.fileSize` puesto al límite del uso más uno**
(`FileMaxSizeBytes`, `src/constants/files.ts:26-30`; `FileUploadSizeSlack`, `:87`), más `files: 1`.

**Por qué "más uno".** Busboy dispara su límite cuando el tamaño acumulado **alcanza**
`fileSize`, no cuando lo supera (`node_modules/busboy/lib/types/multipart.js:476`): con el valor
exacto, un archivo de 2 MB clavados respondía `413` mientras la pantalla 11 promete *"hasta
2 MB"*. Se descubrió en la fase 13 subiendo un PNG de 2 097 152 bytes con `curl`, no leyendo el
código. Con el `+1`, multer sigue cortando en el borde —2 MB + 1 byte responde `413`— y el corte
exacto lo decide `validateUpload`, que es la regla de dominio
(`src/infrastructure/storage/validate_upload.ts:41-43`). Los dos bordes están fijados en
`src/middlewares/test/file_upload.test.ts`.

**Por qué el límite va en multer y no solo en la validación.** Con `memoryStorage`, multer
acumula el archivo en un `Buffer`: si el único tope estuviera en `validateUpload`, un archivo de
2 GB se cargaría **entero en memoria** antes de que nadie lo mirara. Con el límite en multer, la
petición se corta en cuanto se pasa del tamaño y la memoria no se toca.

**Por qué `memoryStorage` y no `diskStorage`.** Los archivos son pequeños (2–20 MB) y el
`Buffer` es justo lo que `validateUpload` necesita para leer los bytes de cabecera
(`src/infrastructure/storage/docs/README.md` §2). Con `diskStorage` habría que escribir primero
y borrar después cada archivo rechazado, que es exactamente lo que la validación previa quiere
evitar.

**`files: 1`** porque los tres usos suben un archivo cada uno; un `multipart` con veinte partes
se corta con `LIMIT_FILE_COUNT` en vez de procesarse.

El error de multer no se maneja aquí: sube al manejador global, que lo traduce (§6). Ese reparto
es lo que permite que el `413` salga con el mismo sobre que todo lo demás.

## 9. `local_files.ts` — solo con el driver local

`localFiles` (`src/middlewares/local_files.ts:17-20`) es `express.static` sobre
`STORAGE_LOCAL_PATH` cuando `STORAGE_DRIVER=local`, y un `next()` vacío
(`:13-15`) cuando es `s3`, porque entonces los archivos los sirve el bucket y esta ruta no debe
existir.

La decisión se toma **al importar el módulo**, no por petición: el driver no cambia en caliente y
resolver un `if` en cada `GET` de una imagen sería trabajo por nada.

`index: false` impide listar el directorio y `dotfiles: 'deny'` corta los `.` de un tirón. Las
claves las genera `buildStorageKey`, así que un punto inicial no puede salir de ahí — pero
`/files` es una ruta pública y lo que la protege no puede depender de quién escribió la clave.

## 10. `optional_authenticate.ts` — el visitante que quizá tenga cuenta

`GET /api/v1/courses/:slug` (fase 09) es **público** y a la vez cambia un campo si hay sesión:
`is_unlocked` vale `true` en todas las lecciones para quien tenga cuenta, y solo en la muestra
gratuita para quien no. Eso exige un Bearer **opcional**: si viene y es bueno, se adjunta el
usuario; si no viene, o viene roto, la petición sigue **como anónima y sin fallar**.

```ts
optionalAuthenticate  →  resolveRequestSession(req, { allow_revoked_session: false })
                         authenticated ? req.user = user : (nada)  →  next()
```

(`src/middlewares/optional_authenticate.ts:5-17`.)

**Por qué NO es `authenticateTokenJwt` envuelto en un `try/catch`.** Es la tentación obvia y está
mal por dos motivos independientes:

1. **Se traga lo que no debe.** Un `catch` alrededor del middleware no distingue "el token
   caducó" de "PostgreSQL no responde". El primero tiene que dejar pasar al visitante como
   anónimo; el segundo tiene que ser un `500`. Con el `catch`, una caída de la base de datos se
   convierte en *"nadie tiene sesión"* y el producto sigue sirviendo páginas como si nada, que es
   exactamente el fallo que nadie detecta hasta que alguien pregunta por qué se cerró la sesión de
   todo el mundo. Hay un test que fija esto: un `findSessionById` que rechaza sale por el
   manejador global como `500 INTERNAL_ERROR`.
2. **Es el revés del control de acceso.** El camino feliz sería "intenta autenticar y, si algo
   falla, sigue"; el correcto es "resuelve la sesión y adjunta el usuario **solo** si todas las
   comprobaciones pasan". Con el `catch`, cada comprobación nueva que alguien añada al autenticador
   estricto se convierte en un `catch` más ancho. Sin él, el opcional hereda la lista completa de
   comprobaciones sin escribir ninguna.

Por eso la fase 09 extrajo `resolve_request_session.ts`: **una sola resolución, dos políticas de
fallo.** El resolvedor devuelve `{ authenticated: false, rejection }` con el motivo
(`SessionRejections`, `src/constants/auth.ts:56-64`); el estricto lo traduce a `AppError`, el
opcional lo ignora. Los errores de infraestructura —Prisma, red— **no son rechazos**: se propagan
tal cual, y por eso llegan al manejador global.

**Un token válido de una sesión revocada no desbloquea nada.** El opcional se construye con
`allow_revoked_session: false`, igual que el estricto: cerrar sesión cierra sesión también en las
rutas públicas. La variante tolerante sigue existiendo **solo** para `/auth/logout` (§5).

**Por qué no renueva la sesión.** `authenticateTokenJwt` empuja el `expires_at` cada 5 minutos de
uso; `optionalAuthenticate` no toca la base de datos. El catálogo y la ficha son las rutas más
visitadas del producto y son de solo lectura: convertir cada visita de un usuario con sesión en un
`UPDATE` es carga de escritura por un dato que cualquier ruta autenticada de verdad ya actualiza.
El precio es que navegar **solo** por páginas públicas no alarga la sesión, lo cual es correcto:
la sesión no se está usando para nada que la necesite.

## 11. `require_verified_email.ts` — el único sitio donde `email_verified_at` importa

`requireVerifiedEmail` (`src/middlewares/require_verified_email.ts:5-13`) lee el usuario que dejó
`authenticateTokenJwt` y delega la regla en `assertVerifiedEmail`
(`src/utils/authenticated_user.ts:21-29`): si `email_verified_at` es `null`, `403
EMAIL_NOT_VERIFIED`; si no, `next()`. No consulta la base: `email_verified_at` viaja en
`AuthenticatedUser` (`src/types/authenticated_user.ts:8`) porque `resolveRequestSession` ya lo
trajo con la sesión (`src/middlewares/resolve_request_session.ts:40`) — la misma razón por la que
`requireAdmin` no vuelve a leer el rol.

**Va siempre después de `authenticateTokenJwt`, nunca en un `router.use()`.** Sin sesión el error
correcto es `401`, no `403`, y ese `401` lo da el autenticador; montado en un router entero, este
middleware exigiría el correo verificado a rutas que D-006 dice que no deben exigirlo. Hoy está en
exactamente dos rutas —crear un comentario y responder— y **no** en listar (es público) ni en
reportar (`src/modules/comments/features/report/create/presentation/create.routes.ts:9-13`):
avisar de algo grave no puede esperar a que alguien abra su correo.

D-006 fija que la verificación **no bloquea el acceso**: un usuario sin verificar navega el
catálogo, ve lecciones, se inscribe y marca progreso. Solo no puede escribir en un hilo público,
que es justo lo que el texto de E5 promete (*"Verifica tu correo para poder comentar"*). Hay un
test que fija cada una de las dos mitades: `src/middlewares/test/require_verified_email.test.ts` y
`src/modules/progress/features/enrollment/create/test/create.controller.test.ts`.
