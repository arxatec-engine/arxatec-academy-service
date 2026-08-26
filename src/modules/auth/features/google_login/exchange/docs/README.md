# `auth/google_login/exchange` — el porqué

**Endpoint 11 del contrato: `POST /api/v1/auth/google/exchange` → `200`.** Canjea el código
opaco que trajo el `302` del callback por una sesión iniciada, con el mismo
`data: { token, expires_at, user }` que devuelven el registro y el login (contrato §3 y
§4.9-11).

```text
domain/        exchange.schema.ts  exchange.payload.ts  exchange.types.ts
data/          exchange.repository.ts
presentation/  exchange.service.ts  exchange.controller.ts  exchange.routes.ts
test/          exchange.service.test.ts  exchange.controller.test.ts
```

## 1. El flujo, de punta a punta

| Paso | Dónde | Qué pasa |
| --- | --- | --- |
| Entrada | `presentation/exchange.routes.ts:9-13` | `POST /google/exchange` con `googleExchangeRateLimit` delante |
| Validación | `presentation/exchange.controller.ts:12` | `googleExchangeSchema.parse(req.body)` |
| Contexto HTTP | `presentation/exchange.controller.ts:16-17` | `User-Agent` e `ip` salen del `req` y viajan como datos planos |
| Reglas | `presentation/exchange.service.ts:31-74` | valida el código, lo consume, abre sesión y firma el JWT |
| Persistencia | `data/exchange.repository.ts:12,20` + repositorios compartidos | `auth_tokens` de este slice; `users` y `auth_sessions` de `shared/` |
| Respuesta | `presentation/exchange.controller.ts:20-27` | `buildHttpResponse` con `HttpStatusCodes.OK` |

Sin `try/catch`: el `ZodError` del parse y el `AppError` del service suben al manejador global
(`src/middlewares/error_handler.ts:121`).

## 2. Un solo uso de verdad: lo garantiza el `UPDATE`, no el `SELECT`

Las tres líneas que importan (`presentation/exchange.service.ts:37-45`):

```text
1. findOauthExchangeToken(hash)     ← lectura
2. isTokenUsable(token, now)        ← ¿sin consumir y sin vencer?
3. consumeOauthExchangeToken(id)    ← UPDATE ... WHERE consumed_at IS NULL  → filas tocadas
```

Entre el paso 2 y el 3 cabe otra petición: dos canjes simultáneos del mismo código leen la misma
fila sin consumir y los dos pasan la comprobación. **Lo que los separa es que el `UPDATE` lleva
`consumed_at: null` en el `where`** (`data/exchange.repository.ts:20-27`), así que la base de
datos decide: uno toca 1 fila y el otro toca 0. El service trata ese 0 como código inválido
(`:43-45`) y no abre sesión.

Sin esa condición en el `where`, el "un solo uso" del contrato sería una comprobación en memoria
con una ventana de carrera —pequeña, pero justo la que un atacante con el código repetiría en
bucle. Fijado en `test/exchange.service.test.ts:186-196`, que simula la carrera devolviendo `0`.

**El código se consume antes de abrir la sesión** (`test/exchange.service.test.ts:112-119`
comprueba el orden de las llamadas). Si fallara la creación de la sesión, el código ya está
quemado y hay que rehacer el rodeo por Google: es la dirección correcta del fallo. Al revés
—sesión primero— un fallo al consumir dejaría un código vivo que ya emitió una sesión.

## 3. El código nunca se busca en claro

`presentation/exchange.service.ts:37` consulta con `hashOneTimeToken(code)`. En `auth_tokens`
solo hay hashes (los escribió el callback), así que la lectura tiene que hashear primero: no es
una precaución opcional, es la única forma de encontrar la fila.

La consecuencia buena es que **el código en claro no aparece en ninguna consulta**, y por tanto
tampoco en el log de consultas lentas de PostgreSQL ni en una traza de Prisma. Fijado en
`test/exchange.service.test.ts:105-110`.

`findOauthExchangeToken` filtra además por `type: OAUTH_EXCHANGE` (`data/exchange.repository.ts:16`):
un token de verificación de correo cuyo hash coincidiera —o, más realista, un futuro bug que
mezcle tipos— no puede canjearse por una sesión. Es `findFirst` y no `findUnique` porque el
`where` compuesto por `token_hash` + `type` no es un índice único del esquema, aunque
`token_hash` lo sea por su cuenta.

## 4. Los tres motivos de rechazo dan la misma respuesta

Código inexistente, código vencido y código ya usado salen todos por `invalidCode()`
(`presentation/exchange.service.ts:26-29`): `400`, `AuthMessages.google.code_invalid` y
`meta.code: TOKEN_INVALID`.

Es una sola fábrica y no tres `throw` paralelos, por el mismo motivo que en el login: tres
respuestas distintas le dirían a quien pruebe códigos al azar **cuál de ellos existió alguna
vez**, y una sola fábrica impide que un cambio futuro toque una rama y separe las otras sin que
nadie lo note. El frontend tampoco necesita distinguirlas: en los tres casos la acción es la
misma —volver a `/ingresar` y reintentar con Google—, y el contrato §5 asigna a `TOKEN_INVALID`
justo esa pantalla.

La excepción es el `404 NOT_FOUND` de `:49-53`: el código era bueno pero el usuario ya no está.
No revela nada (hacía falta un código válido de 60 s para llegar ahí) y decir "no encontramos al
usuario" es más útil que un `400` genérico para el único caso en que ocurre — una cuenta borrada
entre el callback y el canje.

## 5. La sesión que sale de aquí es idéntica a la del login

`presentation/exchange.service.ts:55-73` usa los repositorios y la policy **compartidos**:
`createSession` (`src/modules/auth/shared/data/sessions.repository.ts:44`),
`computeSessionExpiresAt` (`src/modules/auth/shared/policy/session_policy.ts:29`),
`signSessionToken` y `toApiUser`. Este slice no escribe una sola línea de lógica de sesión
propia: si la caducidad deslizante cambia, cambia para todos a la vez.

**`remember_me` es `true` fijo** (`:17`, `:57`). El contrato no da forma de expresar la casilla
"mantener la sesión" en este flujo —la persona está volviendo de Google, no rellenando un
formulario— y `true` es el valor por defecto del login y del registro (contrato §3: la casilla
va marcada por defecto). La consecuencia: quien entra con Google tiene 30 días de inactividad
tolerada, sin opción de 12 h. Cambiarlo pide un campo nuevo en el contrato, no una constante.

El `exp` del JWT se deriva del `expires_at` **que devolvió la fila**, no del que se calculó en
memoria (`:68`), y el `expires_at` del JSON sale de la misma fuente (`:71`): el token y lo que
ve el frontend nunca discrepan. Hereda además la tensión abierta que documenta
`src/infrastructure/docs/README.md` §2 sobre `exp` frente a la renovación deslizante.

`toApiUser` (`:72`) construye la respuesta campo a campo, así que `password_hash` no sale ni
aunque el `select` del repositorio compartido cambie algún día. `findUserById` tampoco lo pide
(`src/modules/auth/shared/data/users.repository.ts:49-50`). Dos barreras, comprobadas en
`test/exchange.service.test.ts:147-154`.

## 6. Validación: un solo campo

`domain/exchange.schema.ts:5-7` — `code`, cadena no vacía, con
`ValidationKeys.auth.code_required` como mensaje (clave i18n, no prosa: el manejador global
descarta lo que no tenga forma de clave, `src/middlewares/error_handler.ts:43`).

**No se valida la longitud ni el alfabeto del código**, aunque se sepan (32 bytes en base64url).
Un código con la forma correcta pero inventado y uno con forma incorrecta merecen la **misma**
respuesta, y hoy la tienen: el primero muere en el `SELECT` con `400 TOKEN_INVALID` y el segundo
también, porque su hash tampoco existe. Un `max()` en el schema convertiría lo segundo en un
`422` y volvería a partir en dos lo que el §4 acaba de unificar. El cuerpo ya está acotado por
el límite de 1 MB de `express.json` (`src/constants/server.ts:3`).

## 7. Rate limit: 20 / hora por IP

`googleExchangeRateLimit` (`src/middlewares/rate_limit.ts:109-112`) implementa la última fila del
contrato §6. Va **en la ruta y no en el controller** (`presentation/exchange.routes.ts:9-13`),
para cortar antes de tocar la base de datos.

Por IP y no por código: la clave tiene que existir **antes** de mirar el cuerpo, y agrupar por el
código sería regalar 20 intentos a cada código probado, que es lo contrario de un límite. Con la
IP, quien quiera adivinar un código de 256 bits dispone de 20 intentos por hora — sobre un
espacio en el que, además, cada código vive 60 s.

Hereda las dos limitaciones de `rate_limit.ts` (documentadas en
`src/middlewares/docs/README.md`): el contador es de memoria del proceso (D-002), así que con dos
instancias el límite efectivo se dobla; y `retry_after_seconds` es la ventana completa, una
espera de más y nunca de menos.

## 8. Los tests

`test/exchange.service.test.ts` (10 casos) mockea por path exacto los cuatro colaboradores
—repositorio del slice, `sessions.repository`, `users.repository` y `sign_session_token`
(`:18-27`)— y deja **real** `hashOneTimeToken`, que es lo que permite afirmar que la búsqueda se
hace por el hash y no por el código. Cubre el canje correcto (orden de llamadas, 30 días,
`user_agent`/`ip`, `jti`, forma de la respuesta) y los cinco caminos de rechazo, incluido el de
la carrera.

`test/exchange.controller.test.ts` (6 casos) monta Express con el manejador global real y mockea
solo el service (`:17-19`). Verifica lo que el service no puede ver: el sobre completo, que el
`200` **no lleva `meta`**, que el `User-Agent` y la IP llegan al service, y que el `400` y el
`422` salen con su `meta.code` — el `422` con `meta.fields.code` exacto.

El cuerpo de la respuesta se tipa parseándolo con un schema Zod del propio test (`:25-36`) y no
con un cast: `response.body` es `any` en los tipos de Supertest, y un `as` para leer `meta.code`
sería el cast que prohíbe `01_reglas_globales.md` §4.

El controller se monta **suelto**, sin `googleExchangeRouter`: `googleExchangeRateLimit` es una
instancia de módulo con estado compartido entre archivos de test, y montarla haría que el número
de peticiones de este fichero fuese parte de su contrato. La cadena de la ruta le toca al test de
integración.
