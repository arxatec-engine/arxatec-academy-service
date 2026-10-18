# `auth/registration/register` — el porqué

**Endpoint 1 del contrato** (`04_contrato_api_auth.md` §4.1): `POST /api/v1/auth/register` → `201`
con `data: { token, expires_at, user }`. Es el único endpoint público que **crea una cuenta y
además devuelve la sesión ya iniciada**: el brief trata el registro como el objetivo del embudo,
así que la persona entra al producto sin pasar por el formulario de ingreso.

```text
POST /auth/register
  registerRateLimit            5/hora por IP        (register.routes.ts:9)
  registerController           usuario → parse → service → sobre
    registerSchema.parse       normaliza y valida   (register.schema.ts:25-31)
    registerUser               reglas y orquestación(register.service.ts:80-114)
      isEmailRegistered        SELECT { id }        (register.repository.ts:20-27)
      hashPassword             argon2id
      createUser               shared/data          (users.repository.ts:52)
      createSession            shared/data          (sessions.repository.ts:44)
      signSessionToken         HS256, jti = sesión
      sendVerificationEmail    best effort (D-002), con resultado de entrega
  201 + buildHttpResponse      (register.controller.ts:20-27)
```

> **La fase 13 sacó dos piezas de este slice a `modules/auth/shared/domain/`**: las reglas de los
> cinco campos de cuenta (`account_fields.schema.ts:12-44`, antes locales en `register.schema.ts`)
> y `resolveAccountFields` (`account_fields.ts:23-31`, antes en `utils/`). Las usa también
> `PATCH /me/profile`, y la superficie sancionada entre módulos es `shared/` (§9.3). El registro
> las importa; la regla sigue siendo una sola.

## 1. Entrada y validación (`domain/register.schema.ts`)

| Campo | Regla | Clave i18n si falla |
| --- | --- | --- |
| `full_name` | recortado, 2–120 (`:8-12`) | `full_name_required` / `full_name_too_long` |
| `email` | normalizado y con formato, ≤ 254 (`:14-21`) | `email_invalid` / `email_too_long` |
| `password` | 8–128 (`:23-26`) | `password_too_short` / `password_too_long` |
| `organization` | opcional, recortado, ≤ 160 (`:28-32`) | `organization_too_long` |
| `is_independent` | opcional, **default `false`** (`:46`) | `errors.validation.invalid` |
| `city` | enum de Prisma opcional; si se omite se guarda `OTHER` | `city_invalid` |
| `city_other` | opcional, ≤ 80; obligatorio si el cliente envía explícitamente `city === OTHER` | `city_other_required` |

El frontend solo recoge `full_name`, `email` y `password` al crear una cuenta. El schema acepta
el alta sin datos de organización ni ciudad. Los valores de perfil se conservan en la respuesta
y pueden completarse después; las validaciones del perfil no cambian.

**El mínimo de 8 no es un número suelto**: sale de `AuthPolicy.password_min_length`
(`src/constants/auth.ts:12`), que es el mismo valor que pinta el hint de la pantalla 02 del
diseño. Los mensajes tampoco son prosa: son **claves de i18n** (`src/constants/validation_keys.ts`),
porque el manejador global copia `issue.message` a `meta.fields` y descarta cualquier texto que no
tenga forma de clave (`src/middlewares/error_handler.ts:43`). Un `422` de este endpoint sale así:

```jsonc
"meta": { "code": "VALIDATION_ERROR", "fields": { "password": "auth.errors.password_too_short" } }
```

**Por qué el correo se valida con `transform` + `pipe` y no con `.email().trim()`** (`:14-21`).
Los checks de Zod 4 corren en el orden en que se encadenan. Si el formato se comprueba antes de
recortar, ` maria@x.pe ` se rechaza como correo inválido cuando el usuario solo pegó un espacio de
más. Se normaliza primero — reutilizando `normalizeEmail` (`src/modules/auth/shared/domain/normalize_email.ts:1`),
que es la **misma** función que usa el repositorio antes de tocar la base — y se valida el formato
después. La columna es `VARCHAR(254) @unique`, no `citext` (`prisma/schema/users.prisma:4`): sin
esta normalización, `Maria@x.pe` y `maria@x.pe` serían dos cuentas.

**Por qué `city_other` se valida con `superRefine` y no con una unión discriminada.** El error tiene
que aterrizar **en el campo `city_other`**, que es donde la pantalla 02 lo pinta. Una unión produce
un `invalid_union` cuyo `path` apunta a la raíz del objeto, y el frontend perdería el sitio del
error. Con `superRefine` el `path` se declara a mano (`:58`). El `trim()` previo (`:36`) hace que
`"   "` cuente como vacío, y hay un test que lo fija.

**Lo que el schema deja fuera importa tanto como lo que deja pasar.** `role`, `email_verified_at`,
`auth_provider` y `avatar_url` **no están en el objeto**, así que Zod los descarta: nadie se
registra como `ADMIN` ni llega con el correo ya verificado desde el cuerpo de la petición. El
`auth_provider` lo pone el service (`register.service.ts:57`) y el rol lo pone el default de la
columna (`prisma/schema/users.prisma:6`).

## 2. Controller (`presentation/register.controller.ts`)

Orden fijo y sin `try/catch` — Express 5 reenvía el rechazo de un handler `async` al manejador
global, y ahí es donde el `AppError` y el `ZodError` se convierten en el sobre del contrato.

El controller añade a lo validado las dos cosas que solo existen en HTTP: `user_agent` e
`ip_address` (`:16-17`). Son datos de la fila de sesión (para que el usuario pueda reconocer sus
sesiones el día que exista esa pantalla), y el repositorio compartido ya los recorta al ancho de la
columna (`src/modules/auth/shared/data/sessions.repository.ts:36`), así que un `User-Agent` de 10 KB
no convierte un registro en un `500` de PostgreSQL.

## 3. Service (`presentation/register.service.ts`)

Sin Express: recibe un `RegisterCommand` y devuelve un `ApiSession`. Cinco decisiones:

**(a) El 409 se comprueba dos veces, y no es redundante.** Antes de hashear se pregunta por el
correo (`:81`), porque hashear con argon2id cuesta ~100 ms y no tiene sentido pagarlos para acabar
en un conflicto. Pero entre esa lectura y el `INSERT` cabe otra petición con el mismo correo, y ahí
el único árbitro es el índice único. Por eso el `createUser` va envuelto (`:48-65`) y una violación
de unicidad se traduce **al mismo** `409 EMAIL_ALREADY_REGISTERED` en vez de escaparse como `500`.
La detección vive en `utils/is_email_taken_error.ts:3`: compara el `code` del error con `P2002`
mirando la propiedad de forma segura, para **no** tener que importar `@/generated/client` desde el
slice (arrastraría el cliente entero a cualquier test que roce este archivo).

**(b) `is_independent: true` fuerza `organization: null`** (`src/modules/auth/shared/domain/account_fields.ts:29`).
La regla es del contrato §4.1 ("se ignora si `is_independent`") y se aplica en el servidor aunque el
formulario ya deshabilite el campo: el formulario es una comodidad, no una garantía. La misma
función anula `city_other` cuando la ciudad no es `OTHER` (`:26`) y convierte la cadena vacía en
`null`, para que la columna no guarde `''` y `null` como dos formas de "no hay dato".

**(c) La sesión es siempre `remember_me: true`** (`:30,90`). Lo dice el contrato §4.1, y encaja con
el producto: quien acaba de crear la cuenta no debería tener que volver a entrar mañana. El
`expires_at` sale de `computeSessionExpiresAt` (`src/modules/auth/shared/policy/session_policy.ts:29`),
que es la función pura y testeada donde vive el número de 30 días
(`AuthTokenTtlSeconds.session_remember_me`, `src/constants/auth.ts:2`).

**(d) El JWT se firma contra la fila ya escrita** (`:96-101`), no contra un `expires_at` calculado
aparte: `jti` es el `id` de la sesión y `exp` se deriva del `expires_at` que devolvió la base. Si
se firmara antes de escribir, un fallo del `INSERT` dejaría en la calle un token con un `jti` que no
existe, y el middleware lo trataría como `SESSION_EXPIRED` sin que nadie entienda por qué.

**(e) El correo de verificación es "mejor esfuerzo", y esto es la trampa del slice** (`:103-107`).
D-002 decidió enviar el correo dentro de la petición, sin cola. La consecuencia obligatoria es que
**un SMTP caído no puede tumbar el registro**: la cuenta ya está creada y la sesión ya está abierta,
así que el fallo se registra con Pino y la respuesta sigue siendo `201`, con
`verification_email_sent: false`. El token fallido se invalida para permitir el reenvío inmediato.
El usuario entra al
producto sin verificar —lo que D-006 permite explícitamente— y reenvía el enlace desde la pantalla
07 (`POST /auth/email/resend`). El `try` cubre **también** el `INSERT` del token
(`:71-75`): si falla la escritura, el reenvío creará otro token y no pasa nada; si en cambio
dejáramos subir el error, tendríamos una cuenta creada y un `500` en la cara del usuario, que es el
peor de los dos mundos.

Del token de verificación **solo el hash toca la base** (`:73`): `createOneTimeToken` devuelve el
valor en claro para el correo y su SHA-256 para la fila (`src/infrastructure/tokens/one_time_token.ts:19`),
que es lo que exige `01_reglas_globales.md` §8.3. Vive 24 h (`AuthTokenTtlSeconds.email_verification`,
`src/constants/auth.ts:4`). Hay un test que comprueba que el token en claro **no** aparece en los
argumentos con los que se llama al repositorio.

## 4. Repositorio (`data/register.repository.ts`)

Dos consultas propias de este slice; el resto se reutiliza de `modules/auth/shared/data`.

| Función | Consulta | Por qué está aquí |
| --- | --- | --- |
| `isEmailRegistered` (`:20`) | `users.findUnique` con `select { id }` (`:5`) | `findUserByEmail` del `shared` trae `password_hash` (es la del login). Para saber si un correo está tomado no hace falta —ni conviene— sacar el hash de la base |
| `createEmailVerificationToken` (`:29`) | `auth_tokens.create`, `select { id, expires_at }` (`:7`) | `auth_tokens` todavía no tiene repositorio compartido. Cuando el slice de reenvío necesite el mismo `INSERT`, esto sube a `shared/data` (§9.2) |

Los dos `select` son explícitos, como exige `02_reglas_backend.md` §7. La creación del usuario y la
de la sesión **no** se duplican aquí: son `createUser` y `createSession` del `shared`, que ya
devuelven el `select` sin `password_hash`.

## 5. Respuesta

`201` con el sobre de `buildHttpResponse` y `data` en la forma exacta del contrato §3:

```jsonc
{
  "status": 201, "message": "Created",
  "description": "Cuenta creada correctamente",
  "path": "/api/v1/auth/register",
  "data": { "token": "eyJ…", "expires_at": "2026-09-19T12:00:00.000Z", "user": { }, "verification_email_sent": true }
}
```

El usuario pasa por `toApiUser` (`src/modules/auth/shared/domain/user_mapper.ts:3`), que construye
el modelo campo a campo: `password_hash` no puede salir ni aunque alguien amplíe el `select`.

Errores que puede devolver este endpoint:

| HTTP | `meta.code` | Cuándo |
| --- | --- | --- |
| `409` | `EMAIL_ALREADY_REGISTERED` | el correo ya tiene cuenta (comprobado antes del `INSERT` y, en carrera, por el índice único) |
| `422` | `VALIDATION_ERROR` | Zod, con `meta.fields` por campo |
| `429` | `RATE_LIMITED` | 5 registros por hora y por IP (`AuthRateLimits.register`, `src/constants/auth.ts:28`), con cabecera `Retry-After` |
| `500` | `INTERNAL_ERROR` | cualquier otro fallo. **Un SMTP caído no entra aquí**: ver §3(e) |

## 6. Montaje

`registerRouter` declara la ruta relativa (`AuthEndpoints.register`, `src/constants/endpoints.ts:10`)
y su rate limit (`register.routes.ts:9`), y se exporta desde
`src/modules/auth/features/registration/index.ts`. **Este slice no se monta a sí mismo**: lo monta
el router del módulo con `authRouter.use(registerRouter)`
(`src/modules/auth/index.ts:12`), que es el único archivo que conoce las seis features.

## 7. Tests (`test/`)

`register.service.test.ts` (16) mockea cada colaborador **por el path exacto** que importa la
implementación, nunca por un barril, y fija: la forma de la sesión devuelta, que el hash y la
contraseña en claro no aparecen en la respuesta, `remember_me: true` con 30 días exactos (reloj
congelado), `organization` a `null` con `is_independent`, `city_other` descartado fuera de `OTHER`,
el `409` por lectura previa y el `409` por carrera (`P2002`), que cualquier otro fallo de base de
datos **sí** sube, que solo el hash del token llega al repositorio, y los dos caminos de D-002 —
correo caído y token caído— con la cuenta creada igual.

`register.controller.test.ts` (11) levanta la ruta con Supertest y el manejador global real, con el
service mockeado: sobre `201`, normalización del correo antes de llegar al service, descarte de
`role` y `email_verified_at`, default de `is_independent`, los `422` por contraseña corta, correo
inválido y `city_other` (nulo y en blanco) con su clave i18n, el `409` del service y el `429` al
sexto intento — este último es el único que pasa por el router completo, precisamente para no gastar
el cupo del limitador en los demás casos.
