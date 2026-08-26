# `auth/email_login/login` — el porqué

**Endpoint 2 del contrato: `POST /api/v1/auth/login` → `200`.** Inicia sesión con correo y
contraseña y devuelve el sobre con `data: { token, expires_at, user }`
(`04_contrato_api_auth.md` §3 y §4.2).

```text
domain/   login.schema.ts  login.payload.ts  login.types.ts  decoy_password_hash.ts
data/     login.repository.ts
presentation/  login.service.ts  login.controller.ts  login.routes.ts
test/     login.service.test.ts  login.controller.test.ts
```

## 1. El flujo, de punta a punta

| Paso | Dónde | Qué pasa |
| --- | --- | --- |
| Entrada | `presentation/login.routes.ts:9` | `POST /login` con los dos limitadores delante (§9) |
| Validación | `presentation/login.controller.ts:18` | `loginSchema.parse(req.body)` — nada de `safeParse` |
| Contexto HTTP | `presentation/login.controller.ts:12-15` | lee `User-Agent` e `ip` y los pasa como datos, no como `req` |
| Reglas | `presentation/login.service.ts:29-74` | busca, compara, decide caducidad, abre sesión, firma |
| Persistencia | `data/login.repository.ts:9,12` | lectura del usuario con hash y alta de la fila de sesión |
| Respuesta | `presentation/login.controller.ts:21-28` | `buildHttpResponse` con `HttpStatusCodes.OK` |

El controller **no lleva `try/catch`** (`02_reglas_backend.md` §3): tanto el `ZodError` del
`parse` como el `AppError` del service suben al manejador global
(`src/middlewares/error_handler.ts:121`), que es quien los convierte en `422` y en `401`/`409`
con el mismo sobre. Express 5 reenvía solo el rechazo de un handler `async`, así que no hace
falta envolverlo.

## 2. La regla que manda en este slice: el login no es un oráculo de correos

`01_reglas_globales.md` §8.2 y el contrato §4.2 piden que **correo inexistente y contraseña
incorrecta sean indistinguibles**. Aquí eso son tres decisiones, no una:

**(a) La misma respuesta.** Los dos caminos lanzan el **mismo** `AppError`, construido en un
único sitio (`presentation/login.service.ts:21-24`): `401`, el mismo `description` y
`meta.code: INVALID_CREDENTIALS`. Tener una sola fábrica y no dos `throw` paralelos es lo que
impide que un cambio futuro toque solo una de las dos ramas y las separe sin que nadie lo note.
El test lo fija comparando las dos excepciones campo a campo
(`test/login.service.test.ts:117-129`).

**(b) El mismo tiempo.** Si el correo no existe se sale antes de comparar nada, y comparar un
argon2id cuesta ~30 ms medidos en este equipo. Esa diferencia es medible desde fuera y
reconstruye la lista de correos registrados sin necesidad de acertar ni una contraseña. Por eso
el camino "usuario no encontrado" **ejecuta igualmente la verificación**, contra un hash señuelo
(`presentation/login.service.ts:37-41`).

`domain/decoy_password_hash.ts:1` es un argon2id real generado con los mismos parámetros por
defecto de la librería (`m=65536,p=4,t=3`, los que produce `hashPassword`,
`src/infrastructure/password/hash_password.ts:3-6`). El coste de `verify` lo fijan los
parámetros embebidos en el propio hash, así que un señuelo con otros parámetros costaría otro
tiempo y no taparía nada. **Si algún día se cambian los parámetros de `hashPassword`, este hash
hay que regenerarlo.**

No es una defensa perfecta —quedan la latencia de la consulta y el ruido de red— pero elimina
el escalón grande y constante, que es el que se ve con veinte peticiones.

**(c) Ningún efecto lateral que delate.** Con credenciales malas no se abre sesión ni se firma
nada (`test/login.service.test.ts:131-139`).

## 3. La única excepción deliberada: `409 ACCOUNT_USES_GOOGLE`

`presentation/login.service.ts:43-47`. Rompe a propósito la indistinguibilidad del punto
anterior, y el contrato §4.2 lo autoriza con su motivo: sin esto, quien creó la cuenta con
Google no tiene forma de saber por qué "su" contraseña no funciona — y el correo, que es lo que
la indistinguibilidad protege, ya lo sabe él porque lo acaba de escribir.

**El predicado es `password_hash === null && auth_provider === GOOGLE`**
(`presentation/login.service.ts:26-27`), no `auth_provider === GOOGLE` a secas. La diferencia
importa: `password_hash` y `auth_provider` son **columnas independientes**
(`prisma/schema/users.prisma:5,13`), así que el esquema permite perfectamente una fila con
`auth_provider: GOOGLE` y hash puesto — es lo que quedaría tras un `/auth/password/reset` sobre
una cuenta de Google, salvo que ese slice decida reescribir también `auth_provider`. Con el
predicado corto, esa persona quedaría encerrada fuera de una contraseña que acaba de fijar ella
misma. El predicado usado aquí no depende de esa decisión ajena: pregunta lo único que importa,
que es si la cuenta tiene contraseña con la que entrar. Está cubierto en
`test/login.service.test.ts:153-162`.

El caso simétrico —`password_hash === null` con `auth_provider: PASSWORD`— es datos corruptos,
no un caso de producto: cae por el camino normal, `verifyPassword` devuelve `false` sin lanzar
(`src/infrastructure/password/hash_password.ts:12-14`) y sale un `401` genérico. Es la respuesta
correcta: no hay nada que ofrecerle al usuario.

Esta rama **no** ejecuta la verificación señuelo. Es coherente: ya está revelando de forma
explícita que la cuenta existe.

## 4. El orden de las tres comprobaciones no es intercambiable

```text
1. ¿existe el usuario?        no → verify(señuelo) → 401
2. ¿es solo-Google?           sí → 409
3. ¿coincide la contraseña?   no → 401
```

La comprobación de Google va **antes** de comparar la contraseña, no después. Si fuera después,
`verifyPassword(null, …)` devolvería `false` y el `401` se adelantaría al `409`: el usuario de
Google vería "correo o contraseña incorrectos" y el `409` sería inalcanzable. Fijado en
`test/login.service.test.ts:143-151`, que además comprueba que `verifyPassword` **no** llegó a
llamarse.

## 5. `remember_me` y la caducidad

El schema lo deja opcional con **default `true`** (`domain/login.schema.ts:20`), que es la
casilla marcada por defecto del diseño y lo que dice la tabla del contrato §3. El default vive
en el schema, no en el service, porque aquí no es una regla de negocio sino el valor que el
formulario habría enviado.

El número lo pone la policy compartida, no este slice:
`computeSessionExpiresAt` (`src/modules/auth/shared/policy/session_policy.ts:30`) traduce el
booleano a 30 días o 12 h desde `AuthTokenTtlSeconds` (`src/constants/auth.ts:2-3`). Duplicar
aquí un `30 * 24 * 60 * 60` sería una segunda copia de una promesa de producto.

**El `expires_at` que sale en el JSON es el de la fila que devolvió la base de datos**
(`presentation/login.service.ts:74`), no el que se calculó en memoria en `:61`. Hoy son el mismo,
pero solo hoy: si la columna adquiere un default o un trigger, la respuesta seguiría diciendo la
verdad.

**El `exp` del JWT es otra fecha a propósito**: el tope absoluto de la sesión,
`computeSessionAbsoluteExpiresAt(session.created_at)` (`:71`). Firmarlo con el `expires_at`
deslizante —que es lo que hacía este slice— expulsaba con `SESSION_EXPIRED` al usuario que entra
todos los días, justo el día 31, con su sesión viva en la base. El porqué completo y las dos
salidas que se compararon están en `src/infrastructure/docs/README.md` §2 y en el contrato §3.

## 6. `user_agent` e `ip`: por qué los lee el controller

Son datos de la petición HTTP, así que los extrae la capa que conoce HTTP
(`presentation/login.controller.ts:12-15`) y el service los recibe ya como valores planos
(`domain/login.types.ts:4-7`). Así el service sigue sin conocer Express (§3 de las reglas) y su
test no necesita fabricar un `Request`.

`req.ip` depende de `app.set('trust proxy', …)`, que se monta en `createApp`
(`src/app/create_app.ts:22`). Con el proxy delante mal configurado, aquí se guardaría la IP del
balanceador; es una propiedad del bootstrap, no de este slice.

El truncado al ancho real de las columnas (`VARCHAR(512)` y `VARCHAR(64)`) ya lo hace
`createSession` (`src/modules/auth/shared/data/sessions.repository.ts:36,50-51`), así que un
`User-Agent` de 10 KB no convierte un login en un `500`. Este slice no lo repite.

`'user-agent'` está como constante local (`presentation/login.controller.ts:10`) y no en
`src/constants/auth.ts`: `AuthHeaders` no tiene una entrada para él y ese archivo es superficie
compartida que este slice no puede tocar. Es la primera fila que le falta a `AuthHeaders`.

## 7. Validación: qué se valida y qué no

| Campo | Regla | Clave i18n |
| --- | --- | --- |
| `email` | `trim` → `toLowerCase` → formato → `max 254` | `auth.errors.email_invalid` / `email_too_long` |
| `password` | no vacío, `max 128` | `errors.validation.required` / `auth.errors.password_too_long` |
| `remember_me` | booleano, opcional, default `true` | `auth.errors.remember_me_invalid` |

**Los mensajes son claves de i18n, no prosa.** El manejador global copia `issue.message` a
`meta.fields` y descarta lo que no tenga forma de clave
(`src/middlewares/error_handler.ts:43`), así que un texto en español acabaría convertido en
`errors.validation.invalid`. Todas salen de `ValidationKeys` (`src/constants/validation_keys.ts`).

**El `trim().toLowerCase()` va antes del formato** (`domain/login.schema.ts:9-10`, con `pipe`
para que el orden sea explícito): sin él, `" Maria@X.pe "` daría un `422` de correo inválido en
vez de entrar. La normalización **para la base de datos** sigue estando en el repositorio
compartido (`src/modules/auth/shared/data/users.repository.ts:45`); esta es la de validación, y
las dos hacen falta porque protegen de cosas distintas.

**La contraseña se valida con `min 1`, no con `min 8`.** El mínimo de 8 es la política de
*registro* (contrato §4.1); aplicarlo también aquí convertiría el intento de una cuenta antigua
o de una contraseña corta en un `422` en vez del `401` que le corresponde. Iniciar sesión es
autenticar, no auditar la política. El `max 128` sí se mantiene, y no por simetría: es lo que
impide que alguien mande una contraseña de 10 MB y haga trabajar a argon2 sobre ella
(`AuthPolicy.password_max_length`, `src/constants/auth.ts:13`).

## 8. `data/` — por qué delega en `shared/`

`data/login.repository.ts` no escribe consultas Prisma propias: llama a `findUserByEmail` y a
`createSession` del repositorio compartido (`:9,12`).

`findUserByEmail` es **la** consulta del login y así está declarada en
`src/modules/auth/shared/docs/README.md` §4: es la única que usa
`AUTH_USER_WITH_PASSWORD_SELECT`, el único `select` del backend que pide `password_hash`.
Escribir aquí una copia de ese `select` crearía un **segundo** sitio donde el hash puede
colarse en un `select` — exactamente el fallo del que protege la regla de `select` explícito
(`02_reglas_backend.md` §7). Una sola copia es auditable de un vistazo; dos no.

Lo que sí aporta este archivo es la frontera de mockeo del slice: el test de service mockea
`.../login/data/login.repository` (`test/login.service.test.ts:15`) y no toca los repositorios
compartidos, así que ningún test de aquí puede romperse por un cambio de firma en `shared` sin
que el compilador lo diga primero.

`toApiUser` (`presentation/login.service.ts:72`) es la segunda barrera: recibe el objeto **con**
hash y construye la respuesta campo a campo, así que el hash no sale aunque el `select` cambie.
Comprobado en `test/login.service.test.ts:231-241`, que además busca la cadena del hash en el
JSON completo.

## 9. Rate limit

La ruta encadena **dos** limitadores (`presentation/login.routes.ts:9`), no uno, y los dos
salen del contrato §6:

| Limitador | Clave | Tope | Qué ataque para |
| --- | --- | --- | --- |
| `loginByIpRateLimit` (`src/middlewares/rate_limit.ts:66-69`) | IP | 30 / 15 min | el **barrido**: una contraseña plausible contra muchos correos desde una máquina |
| `loginByAccountRateLimit` (`src/middlewares/rate_limit.ts:71-75`) | IP + correo | 10 / 15 min | la **fuerza bruta** contra una cuenta concreta |

**Por qué no basta el segundo, que era el único que había.** Con la clave compuesta
`${ip}|${correo}`, cada correo nuevo estrena su propio cubo: rotar el correo daba intentos
ilimitados desde una sola IP. Se comprobó en vivo — 12 intentos contra el mismo correo acababan en
`429`, pero 30 intentos contra 30 correos distintos desde la misma IP salían los 30 con `401`. Los
dos cubos juntos son la misma pareja que ya usaba `/auth/password/forgot`, y
`src/middlewares/test/rate_limit.test.ts` fija los dos cortes.

El tope por IP es más alto que el de cuenta a propósito: una oficina entera detrás del mismo NAT
comparte IP, y 10 sería castigar a los compañeros del que se equivoca de contraseña.

Van montados en la ruta y no dentro del controller porque tienen que cortar antes de que se toque
la base de datos.

**Dependen de que `express.json()` ya haya corrido**, porque la mitad "correo" de la clave sale
de `req.body` (`src/middlewares/rate_limit.ts:39`). En `createApp` el body-parser está en la
cadena global (`src/app/create_app.ts:28`), muy por delante de los routers, así que se cumple.
Si alguien montara este router en una app sin body-parser, el limitador de cuenta **no fallaría**:
se degradaría en silencio a agrupar solo por IP. Es la trampa a vigilar si cambia el bootstrap.

## 10. Los tests

`test/login.service.test.ts` (12 casos) mockea por **path exacto** los tres colaboradores
—repositorio del slice, `hash_password` y `sign_session_token`— y ninguno de ellos por barril
(§10 de las reglas). Cubre: la indistinguibilidad de los dos `401` comparados entre sí, que el
señuelo se verifica de verdad y con qué argumentos, las dos ramas de Google, los 30 días y las
12 h, que `user_agent` e `ip` llegan a la fila, que el `jti` es el id de la sesión y que el hash
no sale en la respuesta.

`test/login.controller.test.ts` (6 casos) monta una app Express mínima con el manejador global
real y ataca por HTTP con Supertest. Verifica lo que el service no puede ver: el sobre completo,
que el `200` no lleva `meta`, que el correo llega normalizado y con `remember_me: true` por
defecto, y que los `401`, `409` y `422` salen con su `meta.code` y —en el `422`— con
`meta.fields` exacto.

El cuerpo de la respuesta se tipa parseándolo con un schema Zod del propio test
(`test/login.controller.test.ts:24-35`) en vez de con un cast: `response.body` es `any` en los
tipos de Supertest, y un `as` para leer `meta.code` sería exactamente el cast prohibido por
`01_reglas_globales.md` §4.

El controller se monta **suelto**, sin `loginRouter`, a propósito: el limitador de
`rate_limit.ts` es una instancia de módulo con estado compartido entre archivos de test, y
montarlo haría que el número de peticiones de este fichero fuese parte de su contrato.
El precio es que la cadena de la ruta no queda cubierta por un test unitario; le toca al test de
integración de la fase 4.10.
