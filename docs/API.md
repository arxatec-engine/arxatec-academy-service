# API — Arxatec Academy

Base: `/api/v1`. Los campos de dominio de la API usan `snake_case`.

[Índice documental](README.md) · [Contratos transversales](planning/http_contracts/README.md) ·
[Matriz de permisos](planning/permissions_audit/README.md).

El listado siguiente cubre los endpoints registrados por el servidor. Los identificadores
públicos de cursos y lecciones son slugs; los del panel son ids. Las rutas bajo `/admin` exigen
Bearer y rol `ADMIN`; las de `/me`, Bearer. Los errores usan `meta.code`.
El temario público incluye `lesson.id` junto a cada slug: ese id alimenta progreso y comentarios;
el contenido de las lecciones bloqueadas sigue ausente.

Las fuentes ejecutables son [rutas](../src/routes/index.ts),
[endpoints](../src/constants/endpoints.ts), schemas y constantes de `src/`. Las secciones 1–8
conservan el detalle de auth y su comprobación histórica; las secciones 9–20 completan catálogo,
aprendizaje, cuenta y administración. La comprobación de 2026-08-21 no certifica rutas añadidas
posteriormente ni un despliegue actual.

## Rutas fuera de autenticación

| Método        | Ruta                                         | Acceso                  | Resultado principal                             |
| ------------- | -------------------------------------------- | ----------------------- | ----------------------------------------------- |
| GET           | `/courses`                                   | público                 | catálogo, búsqueda y facetas                    |
| GET           | `/courses/:slug`                             | público                 | ficha y temario publicado                       |
| GET           | `/courses/:course_slug/lessons/:lesson_slug` | público/Bearer opcional | muestra o lección desbloqueada; `LESSON_LOCKED` |
| POST          | `/courses/:slug/enroll`                      | Bearer                  | inscripción                                     |
| GET           | `/courses/:slug/exam`                        | Bearer                  | examen, acceso y último resultado               |
| POST          | `/courses/:slug/exam/attempts`               | Bearer                  | corrección del examen y certificado al aprobar  |
| PUT           | `/lessons/:lesson_id/progress`               | Bearer                  | minuto guardado                                 |
| POST / DELETE | `/lessons/:lesson_id/complete`               | Bearer                  | completar / desmarcar                           |
| GET           | `/me/courses`                                | Bearer                  | cursos en curso y terminados                    |
| GET           | `/certificates/:id`                          | público                 | certificado verificable y QR                    |
| GET           | `/certificates/:id/pdf`                      | público                 | certificado descargable en PDF                  |
| GET           | `/lessons/:lesson_id/comments`               | público                 | hilo visible                                    |
| POST          | `/lessons/:lesson_id/comments`               | Bearer verificado       | comentario                                      |
| POST          | `/comments/:comment_id/replies`              | Bearer verificado       | respuesta                                       |
| POST          | `/comments/:comment_id/report`               | Bearer                  | reporte                                         |
| PATCH         | `/me/profile`                                | Bearer                  | editar perfil                                   |
| PATCH         | `/me/password`                               | Bearer                  | cambiar contraseña                              |
| PUT / DELETE  | `/me/avatar`                                 | Bearer                  | subir / quitar avatar (`200`)                   |
| GET           | `/me/summary`                                | Bearer                  | resumen de aprendizaje                          |
| DELETE        | `/me`                                        | Bearer                  | baja y borrado de datos                         |
| POST          | `/notifications/signups`                     | público/Bearer opcional | inscribirse a un aviso, idempotente             |
| POST          | `/notifications/topics`                      | público/Bearer opcional | pedir un tema                                   |

La mayoría de estas rutas devuelven `200`; creación de comentarios `201`. El cuerpo y los campos
se validan con los schemas de cada feature. Los dos POST de notificaciones responden `200` sin
`data`, incluso si ya existía la fila.

## Rutas de administración

| Método               | Ruta                                        | Resultado / error distintivo                                                                                                                        |
| -------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET / POST           | `/admin/courses`                            | lista y contadores / crea borrador (`201`)                                                                                                          |
| GET / PATCH          | `/admin/courses/:id`                        | editor y temario / autoguardado con `expected_updated_at`; `STALE_UPDATE`, `SLUG_LOCKED`, `SLUG_TAKEN`                                              |
| POST                 | `/admin/courses/:id/publish`                | publica; `COURSE_HAS_NO_LESSONS`                                                                                                                    |
| POST                 | `/admin/courses/:id/unpublish`              | vuelve a borrador                                                                                                                                   |
| POST                 | `/admin/courses/:id/duplicate`              | copia curso, lecciones y recursos (`201`)                                                                                                           |
| POST                 | `/admin/courses/:id/archive`                | retira sin borrar progreso                                                                                                                          |
| PUT                  | `/admin/courses/order`                      | lista completa de ids; `STALE_CATALOG_ORDER`                                                                                                        |
| PUT                  | `/admin/courses/:id/cover`                  | portada multipart `file`; `IMAGE_TOO_SMALL`                                                                                                         |
| GET / POST           | `/admin/courses/:course_id/lessons`         | temario interno / agrega borrador (`201`)                                                                                                           |
| PUT                  | `/admin/courses/:course_id/lessons/order`   | lista completa de ids; `LESSON_ORDER_MISMATCH`                                                                                                      |
| GET / PATCH / DELETE | `/admin/lessons/:id`                        | detalle / editor / borrado con confirmación cuando hay datos de alumnos                                                                             |
| POST / DELETE        | `/admin/lessons/:id/publish`                | publica / despublica                                                                                                                                |
| POST                 | `/admin/lessons/:lesson_id/resources`       | sube adjunto multipart `file` y `title` (`201`)                                                                                                     |
| PATCH / DELETE       | `/admin/lessons/:lesson_id/resources/:id`   | renombra / quita recurso                                                                                                                            |
| PUT                  | `/admin/lessons/:lesson_id/resources/order` | orden de recursos                                                                                                                                   |
| POST                 | `/admin/videos/probe`                       | `{provider, external_id}`; Vimeo devuelve duración, YouTube devuelve `duration_seconds: null` y exige duración manual en `PATCH /admin/lessons/:id` |
| GET                  | `/admin/comments`                           | pestañas `recent`, `reported`, `hidden`, paginadas                                                                                                  |
| GET                  | `/admin/comments/counts`                    | `pending` y `reported`                                                                                                                              |
| POST                 | `/admin/comments/:id/replies`               | respuesta del equipo (`201`)                                                                                                                        |
| PATCH                | `/admin/comments/:id/status`                | `VISIBLE` / `HIDDEN`; revisa reportes                                                                                                               |
| DELETE               | `/admin/comments/:id`                       | borrado lógico                                                                                                                                      |
| GET                  | `/admin/users`                              | directorio con filtros, stats y paginación                                                                                                          |
| GET                  | `/admin/users/export`                       | CSV de lo filtrado, sin paginar; `EXPORT_TOO_LARGE`                                                                                                 |
| GET                  | `/admin/notifications/signups`              | lista de avisos                                                                                                                                     |
| GET                  | `/admin/notifications/signups/export`       | CSV de avisos                                                                                                                                       |
| POST                 | `/admin/notifications/signups/notify`       | marca las filas anteriores al corte                                                                                                                 |
| GET                  | `/admin/notifications/topics`               | temas agrupados                                                                                                                                     |
| DELETE               | `/admin/notifications/subscribers?email=…`  | olvida la dirección (`204`)                                                                                                                         |

Las descargas CSV son la excepción al sobre JSON: éxito en CSV UTF-8 con BOM, error en el sobre
estándar. Todas las demás rutas de la tabla usan `authenticateTokenJwt` y `requireAdmin`.

## 1. El sobre

Las respuestas JSON de negocio, incluidos los errores, usan
[buildHttpResponse](../src/utils/build_http_response.ts). CSV, redirecciones, archivos, `/ping`
y respuestas 204 tienen su transporte específico:

```jsonc
{
  "status": 200,
  "message": "OK",
  "description": "Sesión iniciada correctamente",
  "timestamp": "2026-08-21T00:30:45.366Z",
  "path": "/api/v1/auth/login",
  "data": {}, // solo si el endpoint devuelve algo
  "meta": {}, // solo si hay código, campos o espera
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
  "created_at": "2026-08-21T00:29:58.025Z",
}
```

`id` es un **cuid**, sin prefijo de recurso ([users.prisma](../prisma/schema/users.prisma)). Las fechas son ISO
8601 con `Z`. **`password_hash` no aparece nunca**: lo impiden dos barreras independientes, el
`select` explícito de los repositorios y la lista campo a campo de `toApiUser`
([user_mapper.ts](../src/modules/auth/shared/domain/user_mapper.ts)).

## 3. Sesión

```jsonc
{ "token": "eyJhbGciOi…", "expires_at": "2026-09-20T00:29:58.028Z", "user": {/* §2 */} }
```

El JWT lleva `sub`, `jti`, `role`, `iat`, `exp` e `iss`, firmado HS256
([sign_session_token.ts](../src/infrastructure/jwt/sign_session_token.ts)). **La base de datos es la autoridad**: cada
petición con autenticación obligatoria comprueba la fila de `auth_sessions` del `jti`
([authenticate_token_jwt.ts](../src/middlewares/authenticate_token_jwt.ts)) y empuja `expires_at` como mucho una vez cada
5 minutos por sesión (`AuthPolicy.session_sliding_renewal_seconds`). Las rutas con
autenticación opcional validan la sesión sin renovar esa ventana.

| `remember_me`    | Inactividad tolerada |
| ---------------- | -------------------- |
| `true` (default) | 30 días              |
| `false`          | 12 horas             |

`expires_at` de la respuesta es esa caducidad por inactividad. El **`exp` del token es otra fecha**:
el tope absoluto de la sesión, 180 días desde que se abrió
(`AuthTokenTtlSeconds.session_absolute_max`). Son distintas porque el `expires_at` de la fila se
mueve con cada uso y un JWT firmado no; firmar el `exp` con la fecha deslizante expulsaba al
usuario activo a los 30 días de haber entrado. Pasado el tope absoluto hay que volver a iniciar
sesión, se haya usado o no.

## 4. Los 11 endpoints

| #   | Método | Ruta                    | Auth    | Límite                                     | Éxito                             |
| --- | ------ | ----------------------- | ------- | ------------------------------------------ | --------------------------------- |
| 1   | `POST` | `/auth/register`        | pública | 5/h por IP                                 | `201` + sesión                    |
| 2   | `POST` | `/auth/login`           | pública | 30/15 min por IP · 10/15 min por IP+correo | `200` + sesión                    |
| 3   | `POST` | `/auth/logout`          | Bearer  | —                                          | `200` sin `data`                  |
| 4   | `GET`  | `/auth/me`              | Bearer  | —                                          | `200` + `{ user }`                |
| 5   | `POST` | `/auth/password/forgot` | pública | 5/h IP · 3/h correo                        | `200` sin `data`                  |
| 6   | `POST` | `/auth/password/reset`  | pública | 20/h por IP                                | `200` sin `data`                  |
| 7   | `POST` | `/auth/email/verify`    | pública | 20/h por IP                                | `200` sin `data`                  |
| 8   | `POST` | `/auth/email/resend`    | Bearer  | 5/h por usuario + 45 s                     | `200` + `{ retry_after_seconds }` |
| 9   | `GET`  | `/auth/google`          | pública | —                                          | `302` a Google                    |
| 10  | `GET`  | `/auth/google/callback` | pública | —                                          | `302` al frontend                 |
| 11  | `POST` | `/auth/google/exchange` | pública | 20/h por IP                                | `200` + sesión                    |

### 1 · `POST /auth/register` → `201`

```jsonc
{
  "full_name": "María Quispe Rojas",
  "email": "maria@estudioqp.pe",
  "password": "unaClaveLarga", // mínimo 8, máximo 128
}
```

El alta solo requiere nombre, correo y contraseña. `organization`, `is_independent`, `city`
y `city_other` siguen siendo aceptados como datos opcionales. Si se omiten, la cuenta se crea
sin organización ni ciudad escrita, con `is_independent: false` y `city: "OTHER"`. Si el cliente
envía explícitamente `city: "OTHER"`, `city_other` sigue siendo obligatorio.

`data: { token, expires_at, user, verification_email_sent }` con la sesión ya abierta y `remember_me: true`
([register.service.ts](../src/modules/auth/features/registration/register/presentation/register.service.ts)). `email` se normaliza a minúsculas y sin espacios; `role` y
`email_verified_at` del cuerpo **se descartan** (no están en el schema).

El correo de verificación se manda en la misma petición y **su fallo no rompe el registro**: la
cuenta y la sesión se devuelven igual, `verification_email_sent` vale `false` y el fallo va al log con `SystemMessages.email_failed`
([register.service.ts](../src/modules/auth/features/registration/register/presentation/register.service.ts)). Es la decisión D-002: sin cola, un SMTP caído no puede costar una
cuenta.

Errores: `409 EMAIL_ALREADY_REGISTERED`, `422 VALIDATION_ERROR`, `429 RATE_LIMITED`.

### 2 · `POST /auth/login` → `200`

```jsonc
{ "email": "maria@estudioqp.pe", "password": "…", "remember_me": true }
```

**Correo inexistente y contraseña incorrecta devuelven exactamente la misma respuesta**
(`401 INVALID_CREDENTIALS`, mismo `description`, mismo `meta`), y el camino "no existe" ejecuta
igualmente un `verify` de argon2 contra un hash señuelo para no filtrar la diferencia por tiempo
([login.service.ts](../src/modules/auth/features/email_login/login/presentation/login.service.ts)). Única excepción: una cuenta creada con Google que aún no tiene
contraseña recibe `409 ACCOUNT_USES_GOOGLE`.

La contraseña se valida aquí con `min(1)`, no con `min(8)`: aplicar la política de registro
convertiría el intento en un `422` y delataría la longitud.

### 3 · `POST /auth/logout` → `200`

Sin cuerpo. La sesión que se cierra es el `jti` del token, nunca un `session_id` del cuerpo.
**Idempotente de verdad**: el segundo `POST` con el mismo token responde `200` con
`description: "La sesión ya estaba cerrada"`, porque esta ruta —y solo ésta— usa
`authenticateRevocableSession` ([logout.routes.ts](../src/modules/auth/features/session/logout/presentation/logout.routes.ts)). Sigue rechazando firma inválida, `jti`
inexistente y sesión **caducada**.

### 4 · `GET /auth/me` → `200`

`data: { user }`. Es la llamada que sostiene el guard del frontend. Errores: `401 UNAUTHENTICATED`
(sin Bearer o mal formado), `401 SESSION_EXPIRED` (sesión revocada o vencida), `404 NOT_FOUND`.

### 5 · `POST /auth/password/forgot` → `200`

```jsonc
{ "email": "maria@estudioqp.pe", "redirect_to": "/curso/fundamentos" } // redirect_to opcional
```

**Responde `200` exista o no el correo**, con el mismo texto y un suelo de tiempo de 400 ms
(`AuthPolicy.password_forgot_min_response_ms`). El enlace vence en 1 hora, es de un solo uso, y
emitir uno nuevo invalida el anterior.

### 6 · `POST /auth/password/reset` → `200`

```jsonc
{ "token": "…", "password": "nuevaClaveLarga" }
```

En una sola transacción: consume el token, cambia el hash, marca el correo como verificado si no lo
estaba y **revoca todas las sesiones del usuario** ([reset.repository.ts](../src/modules/auth/features/password_reset/reset/data/reset.repository.ts)). Token inválido,
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
   **rechaza** con `400 TOKEN_INVALID` ([callback.service.ts](../src/modules/auth/features/google_login/callback/presentation/callback.service.ts)). Sin esa comprobación, quien
   consiga que el proveedor afirme un correo ajeno entra en la cuenta de otro.
2. La cuenta creada con Google queda con `city: "OTHER"` y `city_other: null`, porque `users.city`
   es obligatoria y Google no da ciudad. El registro por correo usa los mismos valores cuando
   no se proporciona ciudad; el formulario de perfil solo permite actualizar el nombre.

## 5. Códigos de error (`meta.code`)

El frontend ramifica por este código estable. Esta tabla cubre autenticación; §18 amplía
los errores de contenido, archivos y administración.

| HTTP | `meta.code`                | Cuándo                                                                                                                          | Dónde se lanza                                                                                                                                                                                                                                                                                                                                |
| ---- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400  | `TOKEN_INVALID`            | token de verificación/reset/canje inválido, caducado o usado; `state` de Google manipulado, vencido o sin la cookie de su nonce | [verify.service.ts](../src/modules/auth/features/email_verification/verify/presentation/verify.service.ts), [reset.service.ts](../src/modules/auth/features/password_reset/reset/presentation/reset.service.ts), [exchange.service.ts](../src/modules/auth/features/google_login/exchange/presentation/exchange.service.ts), `oauth_state.ts` |
| 401  | `INVALID_CREDENTIALS`      | login con correo o contraseña incorrectos                                                                                       | [login.service.ts](../src/modules/auth/features/email_login/login/presentation/login.service.ts)                                                                                                                                                                                                                                              |
| 401  | `UNAUTHENTICATED`          | falta el Bearer, está mal formado o la firma no valida                                                                          | [authenticate_token_jwt.ts](../src/middlewares/authenticate_token_jwt.ts), [verify_session_token.ts](../src/infrastructure/jwt/verify_session_token.ts)                                                                                                                                                                                       |
| 401  | `SESSION_EXPIRED`          | sesión revocada, vencida o inexistente                                                                                          | [authenticate_token_jwt.ts](../src/middlewares/authenticate_token_jwt.ts)                                                                                                                                                                                                                                                                     |
| 403  | `EMAIL_NOT_VERIFIED`       | acción que exige correo verificado: escribir un comentario o una respuesta (fase 12)                                            | `assertVerifiedEmail` ([authenticated_user.ts](../src/utils/authenticated_user.ts)), montado por [require_verified_email.ts](../src/middlewares/require_verified_email.ts)                                                                                                                                                                    |
| 404  | `NOT_FOUND`                | usuario inexistente · ruta inexistente                                                                                          | [get_me.service.ts](../src/modules/auth/features/session/get_me/presentation/get_me.service.ts), [error_handler.ts](../src/middlewares/error_handler.ts)                                                                                                                                                                                      |
| 409  | `EMAIL_ALREADY_REGISTERED` | registro con un correo ya usado                                                                                                 | [register.service.ts](../src/modules/auth/features/registration/register/presentation/register.service.ts)                                                                                                                                                                                                                                    |
| 409  | `ACCOUNT_USES_GOOGLE`      | login con contraseña en una cuenta de Google                                                                                    | [login.service.ts](../src/modules/auth/features/email_login/login/presentation/login.service.ts)                                                                                                                                                                                                                                              |
| 422  | `VALIDATION_ERROR`         | Zod rechazó la entrada                                                                                                          | [error_handler.ts](../src/middlewares/error_handler.ts)                                                                                                                                                                                                                                                                                       |
| 429  | `RESEND_COOLDOWN`          | reenvío antes de los 45 s                                                                                                       | [resend.service.ts](../src/modules/auth/features/email_verification/resend/presentation/resend.service.ts)                                                                                                                                                                                                                                    |
| 429  | `RATE_LIMITED`             | límite de peticiones                                                                                                            | [rate_limit.ts](../src/middlewares/rate_limit.ts)                                                                                                                                                                                                                                                                                             |
| 500  | `INTERNAL_ERROR`           | fallo no controlado                                                                                                             | [error_handler.ts](../src/middlewares/error_handler.ts)                                                                                                                                                                                                                                                                                       |
| 200  | `EMAIL_ALREADY_VERIFIED`   | correo ya verificado (verify y resend)                                                                                          | [verify.controller.ts](../src/modules/auth/features/email_verification/verify/presentation/verify.controller.ts), [resend.controller.ts](../src/modules/auth/features/email_verification/resend/presentation/resend.controller.ts)                                                                                                            |

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
cualquier mensaje que no tenga forma de clave ([error_handler.ts](../src/middlewares/error_handler.ts)).

## 6. Límites de peticiones

La tabla de auth vive en `AuthRateLimits`, en [auth.ts](../src/constants/auth.ts).
Al pasarse: `429` con `RATE_LIMITED` y cabecera `Retry-After`.

`/auth/login` y `/auth/password/forgot` llevan **dos cubos cada uno**, uno por IP y otro por
cuenta. El de cuenta para la fuerza bruta contra un correo concreto; el de IP para el barrido de
contraseñas contra muchos correos, que un solo cubo compuesto (IP + correo) no frena.

Los límites de progreso, comentarios, administración y avisos están en §19. Las dos rutas
públicas que escriben un hilo comparten el mismo cubo por usuario, no cinco comentarios y cinco
respuestas independientes.

**Dos avisos honestos.** Los cubos están en memoria del proceso: con más de una instancia se
multiplican por el número de procesos. Y el `Retry-After` que sale es la ventana completa (p. ej.
3600 s), no lo que resta, porque `express-rate-limit` v8 ya no expone `req.rateLimit`.

## 7. `redirect_to`

Siempre un path relativo que empieza por `/`. Se rechaza cualquier valor con esquema, `//`, host,
barra invertida o caracteres de control ([safe_redirect.ts](../src/utils/safe_redirect.ts)): un
`redirect_to=https://malo.pe` convertiría el login en un redirector abierto. La misma función pura
valida en `forgot` y en el arranque de Google.

## 8. Comprobación histórica de auth — 2026-08-21

El documento anterior registró estas llamadas a los 11 endpoints con `curl` contra el servidor real (`node dist/server.js`, PostgreSQL
del `docker-compose.yml`, `EMAIL_TRANSPORT=log`) el 2026-08-21. Códigos obtenidos:

| Llamada                                                | HTTP                             |
| ------------------------------------------------------ | -------------------------------- |
| `POST /auth/register`                                  | `201`                            |
| `POST /auth/register` (correo repetido)                | `409`                            |
| `POST /auth/register` (cuerpo inválido)                | `422`                            |
| `GET /auth/me`                                         | `200`                            |
| `GET /auth/me` (sin Bearer)                            | `401`                            |
| `POST /auth/email/resend` (dentro del cooldown)        | `429`                            |
| `POST /auth/email/resend` (pasados 45 s)               | `200`                            |
| `POST /auth/email/verify`                              | `200`                            |
| `POST /auth/email/verify` (segundo clic)               | `200` + `EMAIL_ALREADY_VERIFIED` |
| `POST /auth/logout`                                    | `200`                            |
| `POST /auth/logout` (segunda vez)                      | `200`                            |
| `POST /auth/login`                                     | `200`                            |
| `POST /auth/login` (clave incorrecta)                  | `401`                            |
| `POST /auth/password/forgot`                           | `200`                            |
| `POST /auth/password/forgot` (correo inexistente)      | `200`, respuesta idéntica        |
| `POST /auth/password/reset`                            | `200`                            |
| `POST /auth/password/reset` (token ya usado)           | `400`                            |
| `GET /auth/me` (sesión revocada por el reset)          | `401 SESSION_EXPIRED`            |
| `POST /auth/login` (contraseña nueva)                  | `200`                            |
| `GET /auth/google`                                     | `302` a `accounts.google.com`    |
| `GET /auth/google/callback` (state válido, code falso) | `500` — ver abajo                |
| `GET /auth/google/callback` (state manipulado)         | `400 TOKEN_INVALID`              |
| `GET /auth/google/callback` (sin `code` ni `state`)    | `422`                            |
| `POST /auth/google/exchange` (código inexistente)      | `400 TOKEN_INVALID`              |
| `POST /auth/google/exchange` (sin `code`)              | `422`                            |

> **Limitación registrada en esa comprobación.** Con credenciales de desarrollo, Google
> responde `invalid_client` al canjear el código y el fallo del proveedor sale como
> `500 INTERNAL_ERROR` **en JSON, en la pestaña del navegador** — porque esta URL la abre el
> navegador, no `fetch`. La alternativa, redirigir
> a `${FRONTEND_URL}/oauth/callback?error=…`, requiere acordar y probar un parámetro de error con el frontend. La documentación no cambia
> ese comportamiento ni afirma una nueva comprobación del proveedor.

## 9. Catálogo, ficha y lección

`GET /courses` acepta topic/level repetidos o separados por coma y search hasta 120 caracteres.
No pagina. Solo cursos PUBLISHED, ordenados editorialmente. search se normaliza sin acentos ni
mayúsculas y filtra título/descripción corta. Resultado:

```jsonc
{
  "courses": [
    {
      "slug": "fundamentos-de-legal-tech",
      "title": "Fundamentos de Legal Tech",
      "short_description": "Introducción al curso",
      "topic": "FIRST_STEPS",
      "level": "INTRODUCTORY",
      "cover_image_url": null,
      "lesson_count": 2,
      "total_duration_seconds": 660,
    },
  ],
  "facets": {
    "topic": {
      "ALL": 1,
      "FIRST_STEPS": 1,
      "LEGAL_ENGINEERING": 0,
      "APPLIED_AI": 0,
      "ARXATEC_PRODUCT": 0,
    },
    "level": { "INTRODUCTORY": 1, "INTERMEDIATE": 0 },
  },
}
```

Es el contenido de data de un ejemplo, no un inventario de producción. Faceta de tema aplica
nivel, la de nivel aplica tema y ambas omiten search y su propio filtro. ALL suma temas.
Un vacío responde 200 con courses vacío y facetas completas.

`GET /courses/:slug` admite sesión opcional y devuelve `{ course, lessons }`. Course agrega
descripción larga, video_count, article_count y published_at. Lessons incluye id, slug, título,
descripción, tipo, posición, duración/minutos nullable, is_free_sample e is_unlocked. Los
contadores solo consideran publicadas; duración total incluye minutos de artículo × 60.

`GET /courses/:course_slug/lessons/:lesson_slug` devuelve una de estas formas:

| HTTP              | Condición                              | `data`                                            |
| ----------------- | -------------------------------------- | ------------------------------------------------- |
| 200               | Muestra gratuita o sesión activa       | lesson abierta, course y navigation               |
| 403 LESSON_LOCKED | Publicada sin acceso                   | lesson de metadatos, course y lessons del temario |
| 404 NOT_FOUND     | Curso/lección ausentes o no publicados | Sin contenido                                     |

La abierta incluye video `{provider, external_id}` nullable, article_body, transcript,
resources, updated_at y metadatos. Cada recurso tiene title/file_url/mime_type/size_bytes.
La bloqueada no incluye esos cuatro campos de contenido. Navigation contiene previous/next
nullable por slug/título y salta borradores. Correo verificado e inscripción no son requisitos
de lectura. Un Bearer inválido se trata como anónimo en auth opcional.

Temas: FIRST_STEPS, LEGAL_ENGINEERING, APPLIED_AI, ARXATEC_PRODUCT. Niveles: INTRODUCTORY,
INTERMEDIATE. Tipos: VIDEO, ARTICLE. Detalle en [cursos](planning/courses/README.md) y
[lecciones](planning/lessons/README.md).

## 10. Inscripción y avance

Todas estas rutas requieren Bearer; no correo verificado. El usuario se toma de la sesión.

| Ruta                                  | Body                                                   | `data`                                                    |
| ------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| `POST /courses/:slug/enroll`          | Ninguno requerido                                      | `{ enrollment }`                                          |
| `PUT /lessons/:lesson_id/progress`    | `{ "last_position_seconds": 120, "completed": false }` | `{ progress }`                                            |
| `POST /lessons/:lesson_id/complete`   | Ninguno requerido                                      | `{ mark: { lesson_id, completed_at, enrollment } }`       |
| `DELETE /lessons/:lesson_id/complete` | Ninguno requerido                                      | `{ mark: { lesson_id, completed_at: null, enrollment } }` |
| `GET /me/courses`                     | —                                                      | `{ in_progress, completed }`                              |

Todas responden 200. Posición entera 0–86400; completed booleano opcional false. Progress contiene
lesson_id, last_position_seconds, completed_at y updated_at. La posición solo avanza aunque
lleguen eventos atrasados. completed=true ejecuta también el marcado de finalización.

Enrollment contiene course por slug/título, started_at, completed_at nullable,
completed_lessons, lesson_count y next_lesson nullable por slug/título. Inscribirse repetido no
duplica. Completar asegura inscripción y no reescribe una fecha ya sellada. Desmarcar limpia
completed_at de la lección e inscripción, conservando posición; enrollment puede ser null.

Mis cursos separa in_progress (curso, contadores y siguiente) y completed (curso, total y fecha),
solo de cursos publicados. Añadir una lección puede devolver un curso a in_progress sin borrar
su fecha anterior. Un curso sin publicadas no se considera terminado. Ver [progreso](planning/progress/README.md).

### Certificados de finalización

Las inscripciones y ambas listas de Mis cursos incluyen `certificate_id` (UUID o null).
Terminar las lecciones habilita el examen final; solo aprobarlo emite el certificado. El examen
tiene exactamente 15 preguntas, cuatro opciones y una respuesta correcta por pregunta, con
12 aciertos (80 %) como mínimo inicial configurable desde administración. Una nueva marca, un cambio de nombre/título o una lección nueva no
modifica el certificado ya emitido. Eliminar la cuenta lo borra y su enlace deja de resolver.

`GET /certificates/:id` es público y devuelve `data.certificate` con `id`, `recipient_name`,
`course_title`, `completed_at`, `issued_at`, `verification_url` y `qr_code_data_url` (PNG data URL).
No devuelve correos ni ids de usuario/curso. La URL utiliza `FRONTEND_URL` y `/certificados/:id`.
`GET /certificates/:id/pdf` también es público y responde PDF adjunto con el mismo QR y enlace,
sin sobre JSON. Ambas rutas deshabilitan caché HTTP. UUID desconocido: 404; formato inválido: 422.
La descarga acepta `?language=es|en|pt` (es por defecto) y reproduce la tarjeta web con el mismo
logo, tipografía, badge y composición. Un idioma no admitido devuelve 422. El alto se adapta al
contenido y el PDF conserva una página, sin los controles de compartir de la interfaz.
Ver [certificados](../src/modules/progress/features/certificates/docs/README.md).

`GET /admin/courses/:id/exam` y `PUT /admin/courses/:id/exam` requieren ADMIN. PUT acepta
`expected_version` (0 al crear), `enabled`, `passing_score` y 15 `questions` con `text`, cuatro
`options` distintas y `correct_option` (0–3). Devuelve `data.exam` con la versión nueva.
El GET del alumno devuelve `data.exam` y solo muestra preguntas en estado `ready`, tras completar
todas las lecciones publicadas. Nunca incluye `correct_option`. Los demás estados son `locked`,
`unavailable` y `passed` (certificado existente).

El POST de intentos acepta `{ version, answers: [0, ...] }` con 15 respuestas y rechaza campos
extra; usa la identidad de la sesión y corrige en servidor. Devuelve `data.result` con `score`,
`passed`, `passing_score`, `question_count` y `certificate_id` nullable. Está limitado a cinco
envíos por minuto y usuario. Versión cambiada: `409 EXAM_CHANGED`; examen desactivado o sin
configurar: `409 EXAM_UNAVAILABLE`; lecciones pendientes: `403 EXAM_LOCKED`. Respuestas sin
caché HTTP. Intento aprobado y certificado se guardan juntos y los envíos repetidos conservan
el certificado. Los certificados anteriores al examen siguen disponibles. Ver
[exámenes](../src/modules/progress/features/exams/docs/README.md).

## 11. Hilos y reportes

GET de comentarios devuelve `{ comments: [...] }` con raíces y replies visibles. Cada elemento
contiene id, parent_id, body, created_at y author nullable. Author contiene full_name, avatar_url,
affiliation e is_team; nunca correo. No hay paginación pública.

Los POST de raíz/respuesta aceptan `{ "body": "Texto de la consulta" }`, recortado y de 1–2000
caracteres, y devuelven 201 con `{ comment }`. El contenido se trata como texto plano. Requieren
correo verificado. Responder a una respuesta devuelve 422; raíz oculta/no visible, 404.

Reportar acepta `{ "reason": "Motivo opcional" }`, máximo 280, o `{}`. Requiere sesión y devuelve
200 sin data. El índice único evita varios reportes del mismo usuario para el comentario.
Ocultar/borrar una raíz la retira junto con sus respuestas de la proyección pública.
[Contrato de comunidad](planning/comments/README.md).

## 12. Perfil, contraseña, avatar y baja

La lectura actual usa `GET /auth/me` con `{ user }`; `GET /me/profile` no está registrado.
`PATCH /me/profile` recibe únicamente `{ "full_name": "Nombre completo" }`.
El nombre se recorta y debe tener entre 2 y 120 caracteres. Organización, condición de
independiente y ciudad no forman parte del contrato de actualización del perfil; si llegan
en el cuerpo se ignoran. El usuario se identifica por la sesión. No permite cambiar correo,
rol o verificación. Éxito: 200 con `{ user }`.

`PATCH /me/password` recibe current_password no vacía y new_password de 8–128, distinta de la actual.
Devuelve 200 con `{ revoked_sessions }`: revoca las otras, conserva la actual. Google sin hash
responde 409 ACCOUNT_USES_GOOGLE y contraseña actual incorrecta, 401 INVALID_CREDENTIALS.

`PUT /me/avatar` envía un archivo multipart file JPEG/PNG hasta 2 MiB. `DELETE /me/avatar` lo
quita. Ambas responden 200 con `{ user }`; quitar deja avatar_url null. `GET /me/summary` devuelve
`{ member_since, completed_courses }`, contando fechas de cierre persistidas, no cursos al día.

`DELETE /me` recibe `{ "password": "contraseña actual" }` si hay hash; para cuenta sin hash puede
omitirse. Responde 204. Borra datos propios en transacción, incluidos comentarios propios, y
puede retirar respuestas por cascada. No es una desactivación reversible. Detalle en
[usuarios](planning/users/README.md).

## 13. Administración de cursos

Los docentes se guardan en `teachers` y se reutilizan entre cursos. `GET /admin/teachers`
(solo ADMIN) devuelve `{ teachers: [{ id, full_name, biography, photo_url }] }`.
El `PATCH /admin/courses/:id` admite `teacher: { id?, full_name, biography, photo_url }`:
sin id crea un docente; con id edita y asigna el existente; `null` quita la asignación.
El guardado mantiene la comprobación de `expected_updated_at` en una transacción. La ficha
pública `GET /courses/:slug` añade `course.teacher`, nulo o con los tres datos sin id.

Listado devuelve `{ courses, counts }` sin paginación, con archivados al final. counts contiene
total/published/draft/archived. Cada fila incluye id, título, slug, tema, nivel, status,
lesson_count, published_lesson_count, catalog_order y updated_at.

Crear exige title (1–140), topic y level; descripciones son opcionales y vacías por defecto.
Genera slug y DRAFT. Crear/duplicar responden 201 con `{ course, lessons }`. El detalle devuelve
la misma forma, con datos de editor y campos slug_locked, can_publish y fechas. can_publish
refleja el mínimo de lecciones publicadas; el comando valida descripciones aparte.

```json
{
  "expected_updated_at": "2026-10-16T12:00:00.000Z",
  "title": "Fundamentos de Legal Tech",
  "short_description": "Introducción al curso",
  "long_description": "Descripción completa del curso"
}
```

Es un ejemplo de PATCH: requiere la fecha leída más reciente y permite título, slug,
descripciones, topic, level y catalog_order positivo. Slug hasta 160, patrón minúsculas/dígitos
con guiones; descripción corta hasta 140. Conflicto de fecha → 409 STALE_UPDATE.

Publicar exige una lección publicada y descripciones no vacías. Sella published_at solo la
primera vez y desde entonces bloquea slug, incluso despublicado. Archivado no se publica
directamente; despublicar lo deja DRAFT. Archivar no borra progreso y duplicar no copia alumnos.

`PUT /admin/courses/order` recibe `{ "course_ids": ["id-a", "id-b"] }` con todos los activos,
sin archivados; conflicto → 409 STALE_CATALOG_ORDER. Portada usa file multipart JPEG/PNG/WebP,
hasta 5 MiB, horizontal mínimo 1200 × 750. Éxito 200 con detalle.
[Reglas editoriales](planning/courses/README.md).

## 14. Administración de lecciones, recursos y video

Crear bajo el curso recibe `{ "title": "Introducción", "type": "ARTICLE" }` y devuelve
201 con `{ lesson, course }`. Listar devuelve course y lessons de editor. GET de detalle incluye
contenido, recursos con id/posición, métricas de artículo y updated_at.

PATCH permite título, slug, descripción, type, is_free_sample, video_provider,
video_external_id, duration_seconds, article_body, transcript y confirm_type_change. Título/slug
máximo 160, id externo hasta 64. No exige expected_updated_at. Marcar muestra retira la marca
de las otras lecciones del curso.

Cambiar de tipo con contenido devuelve 409 con data.from/to/will_discard y exige confirmación.
El servidor limpia el tipo anterior, sanea artículos y recalcula métricas. Si una edición deja
incompleta una publicada, pasa a DRAFT. Artículo saneado admite hasta 150000 caracteres.

Publicar exige título, slug, descripción y contenido del tipo correspondiente. Si faltan
campos devuelve 422 LESSON_INCOMPLETE con data.missing_fields; artículo vacío, ARTICLE_BODY_EMPTY.
POST `/publish` publica y DELETE `/publish` despublica; ambos devuelven 200 con detalle.

DELETE de lección requiere DRAFT; si hay datos de alumnos, devuelve 409 LESSON_HAS_STUDENT_DATA
con progress_count/comment_count y necesita `{ "confirm_destroys_student_data": true }`.
Publicado devuelve 409 LESSON_PUBLISHED. El éxito es 204 y el borrado físico.

Orden de temario recibe lesson_ids completos; recursos, resource_ids completos. Inconsistencia
responde 422 LESSON_ORDER_MISMATCH. POST de recurso envía file/title multipart y devuelve
201 con resource; PATCH renombra con title; DELETE quita y responde 204. Recurso incluye
id/title/file_url/mime_type/size_bytes/position y se limpia del storage solo sin referencias.

```json
{ "provider": "YOUTUBE", "external_id": "dQw4w9WgXcQ" }
```

Ejemplo estructural del probe, sin garantizar disponibilidad de ese video. Devuelve
`{ duration_seconds, title, thumbnail_url }`. Vimeo exige id numérico y aporta duración;
YouTube exige 11 caracteres y devuelve duración null. YouTube necesita duración manual positiva
al guardar, hasta 2147483647. Un id nuevo sin proveedor elige YouTube.

El probe directo puede devolver 502 VIDEO_PROVIDER_UNAVAILABLE. En PATCH, un fallo temporal
puede guardar como borrador y devolver 200 con ese meta.code. Los errores de video inexistente
/no insertable son 422. [Detalle de contenido](planning/lessons/README.md).

## 15. Moderación

GET `/admin/comments` admite tab recent/reported/hidden, page desde 1 y page_size 20 por defecto,
máximo 50. Devuelve comments, counts y pagination con page/page_size/total/has_next.
Cada fila agrega status, body, is_reply, parent_id, is_answered nullable, report_count,
is_public, autor limitado y referencia de curso/lección.

GET `/counts` devuelve `{ counts: { pending, reported } }`. reported cuenta comentarios visibles
con reportes abiertos; pending une esos comentarios con raíces de autor no ADMIN sin respuesta
visible del equipo. No sumar ambos. recent excluye autores ADMIN; hidden ordena por ocultación.

POST `/:id/replies` recibe body y devuelve 201 con comment/counts. PATCH `/:id/status` recibe
VISIBLE/HIDDEN y devuelve 200 con comment/counts, revisando reportes. DELETE `/:id` borra
lógicamente y responde 200 con estado DELETED; repetir DELETE es aceptado, pero cambiar status
de un borrado devuelve 409 COMMENT_ALREADY_DELETED. [Moderación](planning/comments/README.md).

## 16. Directorio y CSV de usuarios

GET `/admin/users` acepta search (hasta 120), city múltiple, registered_from/registered_to
YYYY-MM-DD, is_independent/email_verified/has_completed de texto true/false, completed_topic
múltiple, sort created_at/full_name, page y per_page. Default 1/25, máximo 100. Día final inclusivo
según offset de reporte; created_at ordena descendente y full_name ascendente con id de desempate.

```jsonc
{
  "data": {
    "users": [],
    "stats": {
      "total_registered": 0,
      "registered_this_week": 0,
      "week_start": "2026-10-12T05:00:00.000Z",
    },
  },
  "meta": { "pagination": { "page": 1, "per_page": 25, "total": 0, "total_pages": 0 } },
}
```

Fragmento ilustrativo del sobre. Stats son globales, no filtradas. Cada usuario devuelve perfil
permitido y completed_courses por fecha de cierre. No hay hash, sesión ni IP en el DTO.

GET `/admin/users/export` usa los mismos filtros sin paginar. CSV con BOM, cabeceras de descarga,
no-store y neutralización de fórmulas. Máximo ADMIN_EXPORT_MAX_ROWS; exceso devuelve
422 EXPORT_TOO_LARGE con meta.row_count/max_rows. [Contrato de usuarios](planning/users/README.md).

## 17. Avisos y demanda de temas

POST `/notifications/signups` recibe email anónimo y course_slug opcional; omitir slug registra
catálogo general y enviarlo exige un curso publicado. POST `/notifications/topics` recibe
email anónimo y search_term de 1–120 sin controles ASCII, con espacios compactados.

Si hay sesión se usa su email y se descarta el del body. Ambas responden 200 sin data; signup
deduplica, pero repetir tema incrementa request_count. La IP se guarda hasheada con sal en
estas tablas.

Listado admin de signups admite course_id, notified true/false, page y per_page (1/25, máximo100)
y devuelve signups/pagination con page/per_page/total/has_next. Alta incluye id/email, course
nullable, created_at, notified_at y has_account por coincidencia con usuario actual.

Exportación usa course_id/notified y devuelve CSV de todas las filas, sin el tope de usuarios.
Omitir course_id incluye catálogo y cursos; no significa seleccionar solo catálogo.

```json
{ "course_id": null, "signed_up_before": "2026-10-16T12:00:00.000Z" }
```

Body de POST `/admin/notifications/signups/notify`: null selecciona catálogo general y el
instante no puede ser futuro. Marca las no avisadas con creación menor o igual al corte;
devuelve `{ marked }`. No envía correos.

GET `/admin/notifications/topics` devuelve topics con search_term, search_term_normalized,
request_count, distinct_emails y last_requested_at. DELETE de subscribers recibe query email,
borra ambas tablas para esa dirección y devuelve 204, o 404 si no existe.
[Contrato de avisos](planning/notifications/README.md).

## 18. Errores adicionales al catálogo de auth

| HTTP | meta.code                                  | Condición                                                    |
| ---- | ------------------------------------------ | ------------------------------------------------------------ |
| 403  | FORBIDDEN                                  | Sesión sin rol ADMIN                                         |
| 403  | LESSON_LOCKED                              | Lección publicada bloqueada o ya no disponible para progreso |
| 409  | SLUG_TAKEN / LESSON_SLUG_TAKEN             | Slug ocupado en su ámbito                                    |
| 409  | SLUG_LOCKED                                | Curso con primera publicación previa                         |
| 409  | STALE_UPDATE / STALE_CATALOG_ORDER         | Fecha o conjunto de orden obsoletos                          |
| 409  | COURSE_HAS_NO_LESSONS                      | Publicar sin lecciones publicadas                            |
| 409  | INVALID_STATE_TRANSITION                   | Publicar curso archivado directamente                        |
| 409  | LESSON_TYPE_CHANGE_NOT_CONFIRMED           | Cambio que descarta contenido sin confirmar                  |
| 409  | LESSON_PUBLISHED / LESSON_HAS_STUDENT_DATA | Borrado no permitido o pendiente de confirmación             |
| 409  | COMMENT_ALREADY_DELETED                    | Cambiar estado de comentario borrado                         |
| 413  | FILE_TOO_LARGE                             | Archivo supera su límite                                     |
| 413  | VALIDATION_ERROR                           | JSON/urlencoded supera 1 MiB                                 |
| 415  | INVALID_FILE_TYPE                          | MIME no admitido o firma distinta                            |
| 422  | IMAGE_TOO_SMALL                            | Dimensiones/orientación de portada inválidas                 |
| 422  | LESSON_ORDER_MISMATCH                      | Conjunto de ids de lecciones/recursos inválido               |
| 422  | LESSON_INCOMPLETE / ARTICLE_BODY_EMPTY     | Contenido insuficiente para publicación                      |
| 422  | VIDEO_NOT_FOUND / VIDEO_NOT_EMBEDDABLE     | Rechazo del proveedor                                        |
| 422  | EXPORT_TOO_LARGE                           | Demasiadas filas en CSV de usuarios                          |
| 502  | VIDEO_PROVIDER_UNAVAILABLE                 | Fallo de red/timeout/respuesta del probe                     |

JSON mal formado y multipart inválido pueden devolver 400 VALIDATION_ERROR. Zod devuelve
422 con fields de claves i18n. Un fallo inesperado devuelve 500 INTERNAL_ERROR; detalles solo
en log. Muchos schemas eliminan claves desconocidas, sin rechazar todo campo adicional.
Los códigos existen en [error_codes](../src/constants/error_codes.ts); su status depende de la
acción. Un 200 puede llevar EMAIL_ALREADY_VERIFIED o VIDEO_PROVIDER_UNAVAILABLE como señal.

## 19. Límites fuera de autenticación

| Operación                              | Límite                          | Clave              |
| -------------------------------------- | ------------------------------- | ------------------ |
| Guardar posición                       | 1/s                             | Usuario            |
| Comentario + respuesta públicos        | 5/h compartidos                 | Usuario            |
| Autoguardado de curso                  | 60/min                          | ADMIN              |
| Probe de video                         | 20/h                            | ADMIN              |
| Respuesta/status/borrado de moderación | 60/h compartidos                | ADMIN              |
| CSV de usuarios                        | 5/h                             | ADMIN              |
| Altas de aviso + tema                  | 10/h IP y 5/h email compartidos | IP/correo efectivo |
| CSV de avisos                          | 20/h                            | ADMIN              |

Los limitadores son locales al proceso, emiten 429 RATE_LIMITED y Retry-After con la ventana
completa. Reenvío de verificación usa RESEND_COOLDOWN con tiempo restante. Reinicio o varias
réplicas afectan la contabilidad en memoria. El resto de rutas no hereda automáticamente una
cuota que no esté montada en su router.

## 20. Salud y archivos fuera de `/api/v1`

GET `/ping` devuelve texto de vida HTTP sin acceder a PostgreSQL. No existe readiness SQL.
Con almacenamiento local, GET `/files/<key>` sirve bytes públicos, sin JWT ni sobre JSON;
con driver s3 esa ruta estática se omite. Los directorios no tienen índice y se deniegan dotfiles.
La firma/MIME/tamaño se valida al subir, no al solicitar una URL ya conocida.

[STORAGE](STORAGE.md) detalla acceso y persistencia; [TESTING](TESTING.md) define el entorno de
verificación. Este contrato describe el código disponible, sin afirmar una nueva prueba en vivo
de las integraciones externas o de producción.
