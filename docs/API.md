# API — módulo de autenticación

Base: `/api/v1`. Todo el JSON va en `snake_case`.

> **Alcance.** Este documento cubre **los once endpoints de `/auth`**, que son los que tienen
> contrato acordado en el harness. Desde la fase 09 el servidor sirve además el catálogo público
> (`GET /api/v1/courses` y `GET /api/v1/courses/:slug`) y, desde la fase 10, la lección
> (`GET /api/v1/courses/:course_slug/lessons/:lesson_slug`, la única ruta pública que responde
> `403 LESSON_LOCKED`); desde la fase 11 sirve además los **cinco endpoints de progreso** con
> Bearer obligatorio (`POST /api/v1/courses/:slug/enroll`,
> `PUT`/`POST`/`DELETE /api/v1/lessons/:lesson_id/{progress,complete}` y
> `GET /api/v1/me/courses`). El contrato de los ocho vive, de momento, en el `docs/README.md` de
> cada slice (`src/modules/courses/features/{catalog,lessons}/*/docs/` y
> `src/modules/progress/features/*/*/docs/`). Consolidarlo aquí es trabajo de la fase 19.

> **Fuente de la verdad.** El contrato acordado con el frontend es
> `harness/04_contrato_api_auth.md`; la fuente **en ejecución** son los schemas Zod
> (`src/modules/auth/**/domain/*.schema.ts`) y las tablas de `src/constants`. Este documento
> describe lo que el servidor hace hoy, comprobado endpoint a endpoint contra un servidor real
> (§8). Donde el código y el `.md` del harness discrepan, se dice aquí explícitamente.

## 1. El sobre

Toda respuesta, incluidos los errores, sale de `buildHttpResponse`
(`src/utils/build_http_response.ts:28-52`):

```jsonc
{
  "status": 200,
  "message": "OK",
  "description": "Sesión iniciada correctamente",
  "timestamp": "2026-08-21T00:30:45.366Z",
  "path": "/api/v1/auth/login",
  "data": { },        // solo si el endpoint devuelve algo
  "meta": { }         // solo si hay código, campos o espera
}
```

`data` y `meta` **se omiten** cuando no aplican; no llegan como `null`. `description` es texto
para humanos y cambia con el idioma: el frontend nunca lo compara — para ramificar está
`meta.code`.

## 2. Modelo de usuario

```jsonc
{
  "id": "cmt27py150000hva4ebf034qw",
  "full_name": "Curl Manual",
  "email": "maria@estudioqp.pe",
  "role": "STUDENT",
  "organization": null,
  "is_independent": true,
  "city": "LIMA",
  "city_other": null,
  "avatar_url": null,
  "email_verified_at": null,
  "auth_provider": "PASSWORD",
  "created_at": "2026-08-21T00:29:58.025Z"
}
```

`id` es un **cuid**, no un cuid con prefijo (`prisma/schema/users.prisma:2`). Las fechas son ISO
8601 con `Z`. **`password_hash` no aparece nunca**: lo impiden dos barreras independientes, el
`select` explícito de los repositorios y la lista campo a campo de `toApiUser`
(`src/modules/auth/shared/domain/user_mapper.ts:3-16`).

## 3. Sesión

```jsonc
{ "token": "eyJhbGciOi…", "expires_at": "2026-09-20T00:29:58.028Z", "user": { /* §2 */ } }
```

El JWT lleva `sub`, `jti`, `role`, `iat`, `exp` e `iss`, firmado HS256
(`src/infrastructure/jwt/sign_session_token.ts:24-34`). **La base de datos es la autoridad**: cada
petición autenticada comprueba la fila de `auth_sessions` del `jti`
(`src/middlewares/authenticate_token_jwt.ts:33-58`) y empuja `expires_at` como mucho una vez cada
5 minutos por sesión (`AuthPolicy.session_sliding_renewal_seconds`).

| `remember_me` | Inactividad tolerada |
| --- | --- |
| `true` (default) | 30 días |
| `false` | 12 horas |

`expires_at` de la respuesta es esa caducidad por inactividad. El **`exp` del token es otra fecha**:
el tope absoluto de la sesión, 180 días desde que se abrió
(`AuthTokenTtlSeconds.session_absolute_max`). Son distintas porque el `expires_at` de la fila se
mueve con cada uso y un JWT firmado no; firmar el `exp` con la fecha deslizante expulsaba al
usuario activo a los 30 días de haber entrado. Pasado el tope absoluto hay que volver a iniciar
sesión, se haya usado o no.

## 4. Los 11 endpoints

| # | Método | Ruta | Auth | Límite | Éxito |
| --- | --- | --- | --- | --- | --- |
| 1 | `POST` | `/auth/register` | pública | 5/h por IP | `201` + sesión |
| 2 | `POST` | `/auth/login` | pública | 30/15 min por IP · 10/15 min por IP+correo | `200` + sesión |
| 3 | `POST` | `/auth/logout` | Bearer | — | `200` sin `data` |
| 4 | `GET` | `/auth/me` | Bearer | — | `200` + `{ user }` |
| 5 | `POST` | `/auth/password/forgot` | pública | 5/h IP · 3/h correo | `200` sin `data` |
| 6 | `POST` | `/auth/password/reset` | pública | 20/h por IP | `200` sin `data` |
| 7 | `POST` | `/auth/email/verify` | pública | 20/h por IP | `200` sin `data` |
| 8 | `POST` | `/auth/email/resend` | Bearer | 5/h por usuario + 45 s | `200` + `{ retry_after_seconds }` |
| 9 | `GET` | `/auth/google` | pública | — | `302` a Google |
| 10 | `GET` | `/auth/google/callback` | pública | — | `302` al frontend |
| 11 | `POST` | `/auth/google/exchange` | pública | 20/h por IP | `200` + sesión |

### 1 · `POST /auth/register` → `201`

```jsonc
{
  "full_name": "María Quispe Rojas",
  "email": "maria@estudioqp.pe",
  "password": "unaClaveLarga",      // mínimo 8, máximo 128
  "organization": "Estudio Quispe & Rojas",  // opcional; se ignora si is_independent
  "is_independent": false,          // opcional, default false
  "city": "LIMA",                   // LIMA | AREQUIPA | TRUJILLO | OTHER
  "city_other": null                // requerido si city === "OTHER"
}
```

`data: { token, expires_at, user }` con la sesión ya abierta y `remember_me: true`
(`register.service.ts:30`). `email` se normaliza a minúsculas y sin espacios; `role` y
`email_verified_at` del cuerpo **se descartan** (no están en el schema).

El correo de verificación se manda en la misma petición y **su fallo no rompe el registro**: la
cuenta y la sesión se devuelven igual y el fallo va al log con `SystemMessages.email_failed`
(`register.service.ts:103-107`). Es la decisión D-002: sin cola, un SMTP caído no puede costar una
cuenta.

Errores: `409 EMAIL_ALREADY_REGISTERED`, `422 VALIDATION_ERROR`, `429 RATE_LIMITED`.

### 2 · `POST /auth/login` → `200`

```jsonc
{ "email": "maria@estudioqp.pe", "password": "…", "remember_me": true }
```

**Correo inexistente y contraseña incorrecta devuelven exactamente la misma respuesta**
(`401 INVALID_CREDENTIALS`, mismo `description`, mismo `meta`), y el camino "no existe" ejecuta
igualmente un `verify` de argon2 contra un hash señuelo para no filtrar la diferencia por tiempo
(`login.service.ts:37-41`). Única excepción: una cuenta creada con Google que aún no tiene
contraseña recibe `409 ACCOUNT_USES_GOOGLE`.

La contraseña se valida aquí con `min(1)`, no con `min(8)`: aplicar la política de registro
convertiría el intento en un `422` y delataría la longitud.

### 3 · `POST /auth/logout` → `200`

Sin cuerpo. La sesión que se cierra es el `jti` del token, nunca un `session_id` del cuerpo.
**Idempotente de verdad**: el segundo `POST` con el mismo token responde `200` con
`description: "La sesión ya estaba cerrada"`, porque esta ruta —y solo ésta— usa
`authenticateRevocableSession` (`logout.routes.ts:9`). Sigue rechazando firma inválida, `jti`
inexistente y sesión **caducada**.

### 4 · `GET /auth/me` → `200`

`data: { user }`. Es la llamada que sostiene el guard del frontend. Errores: `401 UNAUTHENTICATED`
(sin Bearer o mal formado), `401 SESSION_EXPIRED` (sesión revocada o vencida), `404 NOT_FOUND`.

### 5 · `POST /auth/password/forgot` → `200`

```jsonc
{ "email": "maria@estudioqp.pe", "redirect_to": "/curso/fundamentos" }  // redirect_to opcional
```

**Responde `200` exista o no el correo**, con el mismo texto y un suelo de tiempo de 400 ms
(`AuthPolicy.password_forgot_min_response_ms`). El enlace vence en 1 hora, es de un solo uso, y
emitir uno nuevo invalida el anterior.

### 6 · `POST /auth/password/reset` → `200`

```jsonc
{ "token": "…", "password": "nuevaClaveLarga" }
```

En una sola transacción: consume el token, cambia el hash, marca el correo como verificado si no lo
estaba y **revoca todas las sesiones del usuario** (`reset.repository.ts:28-52`). Token inválido,
vencido o ya usado → `400 TOKEN_INVALID`.

### 7 · `POST /auth/email/verify` → `200`

`{ "token": "…" }`. Idempotente: el segundo clic responde `200` con
`meta.code: "EMAIL_ALREADY_VERIFIED"`. Ningún `data`: el token viaja en un correo y devolver el
perfil entregaría el usuario a quien tenga el enlace.

### 8 · `POST /auth/email/resend` → `200`

Sin cuerpo (se acepta `{}` o nada). `data: { retry_after_seconds: 45 }` para que la UI arranque su
cuenta atrás. Antes de tiempo → `429 RESEND_COOLDOWN` con `meta.retry_after_seconds` (los segundos
que faltan, no la ventana). Un correo ya verificado responde `200` con
`meta.code: "EMAIL_ALREADY_VERIFIED"` y `data.retry_after_seconds: 0`, **sin** mandar correo.

### 9–11 · Google

```text
GET  /auth/google?redirect_to=/curso/x
     → 302 a accounts.google.com; redirect_to viaja firmado (HMAC-SHA256) dentro del state
     → Set-Cookie: arxatec_oauth_state=<nonce>; HttpOnly; SameSite=Lax  (ata el state al navegador)
GET  /auth/google/callback?code=…&state=…   (con esa cookie, o 400 TOKEN_INVALID)
     → 302 a ${FRONTEND_URL}/oauth/callback?code=<código de un solo uso>&redirect_to=…
POST /auth/google/exchange { "code": "…" }
     → 200 { token, expires_at, user }
```

El código intermedio es opaco, se guarda hasheado, **vive 60 s y es de un solo uso**: un JWT en la
URL quedaría en el historial, en el `Referer` y en los logs de cualquier proxy.

Dos comportamientos que **no** están en el contrato y conviene conocer:

1. Si Google **no** declara verificado el correo y ya existe una cuenta con él, el enlace se
   **rechaza** con `400 TOKEN_INVALID` (`callback.service.ts:41-43`). Sin esa comprobación, quien
   consiga que el proveedor afirme un correo ajeno entra en la cuenta de otro.
2. La cuenta creada con Google queda con `city: "OTHER"` y `city_other: null`, porque `users.city`
   es obligatoria y Google no da ciudad. Es una combinación que el registro por formulario no
   aceptaría; hace falta un "completa tu perfil" o admitir `city` nula para cuentas de Google.

## 5. Códigos de error (`meta.code`)

El frontend ramifica **solo** por este código. Los 12 del contrato §5 existen y se emiten; el
decimotercero lo exige el §4.7 del propio contrato, que la tabla no recogía.

| HTTP | `meta.code` | Cuándo | Dónde se lanza |
| --- | --- | --- | --- |
| 400 | `TOKEN_INVALID` | token de verificación/reset/canje inválido, caducado o usado; `state` de Google manipulado, vencido o sin la cookie de su nonce | `verify.service.ts:13`, `reset.service.ts:17`, `exchange.service.ts:26`, `oauth_state.ts` |
| 401 | `INVALID_CREDENTIALS` | login con correo o contraseña incorrectos | `login.service.ts:21` |
| 401 | `UNAUTHENTICATED` | falta el Bearer, está mal formado o la firma no valida | `authenticate_token_jwt.ts:20`, `verify_session_token.ts:19` |
| 401 | `SESSION_EXPIRED` | sesión revocada, vencida o inexistente | `authenticate_token_jwt.ts:23` |
| 403 | `EMAIL_NOT_VERIFIED` | acción que exige correo verificado: escribir un comentario o una respuesta (fase 12) | `assertVerifiedEmail` (`src/utils/authenticated_user.ts:22-26`), montado por `src/middlewares/require_verified_email.ts:5-13` |
| 404 | `NOT_FOUND` | usuario inexistente · ruta inexistente | `get_me.service.ts:14`, `error_handler.ts:110` |
| 409 | `EMAIL_ALREADY_REGISTERED` | registro con un correo ya usado | `register.service.ts:32` |
| 409 | `ACCOUNT_USES_GOOGLE` | login con contraseña en una cuenta de Google | `login.service.ts:44` |
| 422 | `VALIDATION_ERROR` | Zod rechazó la entrada | `error_handler.ts:77-83` |
| 429 | `RESEND_COOLDOWN` | reenvío antes de los 45 s | `resend.service.ts:35` |
| 429 | `RATE_LIMITED` | límite de peticiones | `rate_limit.ts:59` |
| 500 | `INTERNAL_ERROR` | fallo no controlado | `error_handler.ts:103-107` |
| 200 | `EMAIL_ALREADY_VERIFIED` | correo ya verificado (verify y resend) | `verify.controller.ts:21`, `resend.controller.ts:30` |

> **`EMAIL_NOT_VERIFIED` sigue sin emitirlo ningún endpoint de auth, y desde la fase 12 ya no está
> sin uso.** Lo emiten las dos rutas que escriben en un hilo de comentarios
> (`POST /lessons/:id/comments` y `POST /comments/:id/replies`) a través del middleware
> `requireVerifiedEmail`. Es el **único** sitio de todo el producto donde `email_verified_at`
> importa (D-006): el catálogo, las lecciones, la inscripción y el progreso no lo miran.

El `422` añade el detalle por campo, que es lo que permite pintar el error donde está el problema:

```jsonc
"meta": {
  "code": "VALIDATION_ERROR",
  "fields": {
    "full_name": "auth.errors.full_name_required",
    "email": "auth.errors.email_invalid",
    "password": "auth.errors.password_too_short"
  }
}
```

**`fields` lleva claves i18n, nunca texto**: el catálogo está en
`src/constants/validation_keys.ts` y el manejador global degrada a `errors.validation.invalid`
cualquier mensaje que no tenga forma de clave (`error_handler.ts:43`).

## 6. Límites de peticiones

La tabla vive en `AuthRateLimits` (`src/constants/auth.ts:28-38`) y coincide con el contrato §6.
Al pasarse: `429` con `RATE_LIMITED` y cabecera `Retry-After`.

`/auth/login` y `/auth/password/forgot` llevan **dos cubos cada uno**, uno por IP y otro por
cuenta. El de cuenta para la fuerza bruta contra un correo concreto; el de IP para el barrido de
contraseñas contra muchos correos, que un solo cubo compuesto (IP + correo) no frena.

Fuera de auth hay dos cubos más, con la misma fábrica y el mismo `429`: el del guardado de
progreso (1/s por usuario, fase 11) y el de comentarios (**5/h por usuario**, fase 12), que cuenta
juntas las dos rutas que escriben en un hilo (`src/constants/comments.ts:8-10`).

**Dos avisos honestos.** Los cubos están en memoria del proceso: con más de una instancia se
multiplican por el número de procesos. Y el `Retry-After` que sale es la ventana completa (p. ej.
3600 s), no lo que resta, porque `express-rate-limit` v8 ya no expone `req.rateLimit`.

## 7. `redirect_to`

Siempre un path relativo que empieza por `/`. Se rechaza cualquier valor con esquema, `//`, host,
barra invertida o caracteres de control (`src/utils/safe_redirect.ts:4-31`): un
`redirect_to=https://malo.pe` convertiría el login en un redirector abierto. La misma función pura
valida en `forgot` y en el arranque de Google.

## 8. Comprobado en vivo

Los 11 endpoints se llamaron con `curl` contra el servidor real (`node dist/server.js`, PostgreSQL
del `docker-compose.yml`, `EMAIL_TRANSPORT=log`) el 2026-08-21. Códigos obtenidos:

| Llamada | HTTP |
| --- | --- |
| `POST /auth/register` | `201` |
| `POST /auth/register` (correo repetido) | `409` |
| `POST /auth/register` (cuerpo inválido) | `422` |
| `GET /auth/me` | `200` |
| `GET /auth/me` (sin Bearer) | `401` |
| `POST /auth/email/resend` (dentro del cooldown) | `429` |
| `POST /auth/email/resend` (pasados 45 s) | `200` |
| `POST /auth/email/verify` | `200` |
| `POST /auth/email/verify` (segundo clic) | `200` + `EMAIL_ALREADY_VERIFIED` |
| `POST /auth/logout` | `200` |
| `POST /auth/logout` (segunda vez) | `200` |
| `POST /auth/login` | `200` |
| `POST /auth/login` (clave incorrecta) | `401` |
| `POST /auth/password/forgot` | `200` |
| `POST /auth/password/forgot` (correo inexistente) | `200`, respuesta idéntica |
| `POST /auth/password/reset` | `200` |
| `POST /auth/password/reset` (token ya usado) | `400` |
| `GET /auth/me` (sesión revocada por el reset) | `401 SESSION_EXPIRED` |
| `POST /auth/login` (contraseña nueva) | `200` |
| `GET /auth/google` | `302` a `accounts.google.com` |
| `GET /auth/google/callback` (state válido, code falso) | `500` — ver abajo |
| `GET /auth/google/callback` (state manipulado) | `400 TOKEN_INVALID` |
| `GET /auth/google/callback` (sin `code` ni `state`) | `422` |
| `POST /auth/google/exchange` (código inexistente) | `400 TOKEN_INVALID` |
| `POST /auth/google/exchange` (sin `code`) | `422` |

> **El `500` del callback es real y hay que decidirlo.** Con credenciales de desarrollo, Google
> responde `invalid_client` al canjear el código y el fallo del proveedor sale como
> `500 INTERNAL_ERROR` **en JSON, en la pestaña del navegador** — porque esta URL la abre el
> navegador, no `fetch`. Lo mismo pasaría si el usuario cancela en Google. La alternativa, redirigir
> a `${FRONTEND_URL}/oauth/callback?error=…`, exige un parámetro de error que el contrato §4.10 no
> define: es la primera fila que le falta a ese apartado.
