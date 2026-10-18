# `resend` — `POST /api/v1/auth/email/resend`

Endpoint **8** del contrato (`harness/04_contrato_api_auth.md` §4.8). **Autenticado**: al
registrarse el usuario ya recibe sesión (§4.1), y la pantalla 07 ("revisa tu correo") se pinta con
esa sesión abierta. Por eso el usuario sale del Bearer y no del cuerpo.

## 1. El recorrido

| Paso | Archivo | Qué hace |
| --- | --- | --- |
| Ruta | `presentation/resend.routes.ts:10-15` | `authenticateTokenJwt` → `emailResendRateLimit` → controller |
| Usuario | `presentation/resend.controller.ts:11` | `getAuthenticatedUser(req)` (`src/utils/authenticated_user.ts:9`) |
| Validación | `domain/resend.schema.ts:3` | el contrato no define cuerpo |
| Service | `presentation/resend.service.ts:21-52` | cooldown → rota el token → envía |
| Repositorio | `data/resend.repository.ts:5,15` | última fecha de envío y rotación atómica |

La respuesta `200` lleva `data: { retry_after_seconds }` (`resend.controller.ts:28`) porque el
contrato lo exige literalmente: la cuenta atrás de la pantalla 07 arranca con el número que manda
el backend, no con un `45` escrito en el frontend. El valor sale de
`AuthPolicy.resend_cooldown_seconds` (`src/constants/auth.ts:11`).

## 2. El orden de los middlewares no es decorativo

`emailResendRateLimit` agrupa por `req.user.id` (`src/middlewares/rate_limit.ts:41,103-107`), y
`userKey` cae a la IP cuando no hay usuario. Montado **antes** de `authenticateTokenJwt` no
fallaría: se degradaría en silencio a un límite por IP y dos personas en la misma oficina
compartirían los 5 reenvíos por hora. Por eso el autenticador va primero
(`resend.routes.ts:12-13`).

Son dos frenos distintos y hacen falta los dos: el limitador es el techo por hora del contrato §6
(429 `RATE_LIMITED`), y el cooldown de 45 s es el ritmo entre envíos (429 `RESEND_COOLDOWN`, que
es el que el frontend usa para reiniciar el contador).

## 3. De dónde sale "cuándo fue el último envío"

No hay columna de "último reenvío" ni caché: la fecha es la del token de verificación más reciente
del usuario, `auth_tokens.created_at` (`data/resend.repository.ts:5-13`). Es la misma fila que
crea el registro (contrato §4.1), así que el cooldown ya está corriendo cuando el usuario aterriza
en la pantalla 07 recién registrado — que es exactamente lo que la pantalla promete.

La consulta toma solo tokens activos (`consumed_at: null`). Tras un envío correcto, el token
nuevo está activo y conserva el cooldown. Si falla SMTP, el token nuevo se invalida para que
el usuario pueda reintentar sin esperar por un mensaje que no salió.

`resolveResendCooldown` (`domain/resend_cooldown.ts:15-38`) es pura y tiene test propio, por la
misma razón que `session_policy` en `shared/`: concentra un número que el producto promete y se
puede probar con fechas fijas, sin base de datos. Lo que fija su test:

- el corte es `>=` (`:25`): a los 45 s exactos **sí** deja reenviar;
- redondea hacia arriba (`:29`): nunca promete menos espera de la que queda, o la UI reintentaría
  un segundo antes de tiempo y comería un 429;
- con el reloj desajustado (una fecha futura) bloquea, pero nunca promete más que el propio
  cooldown (`:33-36`);
- sin ningún token previo, deja pasar.

## 4. Rotar el token: una sola escritura

`rotateEmailVerificationToken` (`data/resend.repository.ts:15-38`) mete en un `$transaction` el
`updateMany` que marca como consumidos los tokens de verificación vivos del usuario y el `create`
del nuevo. Invalidar el anterior es lo que pide el encargo, y hacerlo en la misma transacción
evita el hueco en el que el usuario tendría **dos** enlaces válidos o **ninguno**. El nuevo token
nace con `consumed_at: null` y no se pisa a sí mismo porque el `updateMany` se evalúa antes dentro
de la misma transacción.

El token en claro solo existe en memoria y viaja al correo; a la base va únicamente su SHA-256
(`presentation/resend.service.ts:42-49`, `src/infrastructure/tokens/one_time_token.ts:14-22`). El
test lo comprueba de la forma fuerte: extrae el token del enlace del correo, lo hashea y exige que
coincida con el `token_hash` que recibió el repositorio.

## 5. Dos decisiones que el contrato no cubre

**Correo ya verificado** (`resend.service.ts:25-27`): no se manda nada y se responde `200`. Mandar
un enlace de verificación a un correo ya verificado es correo inútil y un vector de spam gratis
(cualquiera con la sesión abierta podría bombardear su propia bandeja). `retry_after_seconds`
sale `0` porque no hay nada que esperar: no queda ningún envío pendiente. La rama lleva además
`meta.code: EMAIL_ALREADY_VERIFIED` (`resend.controller.ts:30`,
`src/constants/error_codes.ts:7`), que es lo que permite al frontend distinguirla sin leer la
`description`; el porqué del código está en `../../docs/README.md` §3.

**Si el envío falla**, el error sube y el usuario ve un `500` (`resend.service.ts:49`). Es lo
contrario de lo que hace el registro, donde la cuenta se crea aunque el correo no salga (D-002):
allí el correo es un efecto secundario, aquí es **el** propósito de la petición, y responder `200`
con la cuenta atrás corriendo mientras el correo no ha salido dejaría al usuario esperando 45 s
para volver a fallar.

## 6. Tests

- `test/resend_cooldown.test.ts` — la función pura, los bordes y que no muta la fecha.
- `test/resend.service.test.ts` — cooldown, rotación, correspondencia token/hash y la rama de
  correo ya verificado. `@/infrastructure/email/send_email` y el repositorio van mockeados por su
  path exacto; la plantilla es la real, para que el test lea el enlace que recibiría el usuario.
- `test/resend.controller.test.ts` — Supertest sobre el **router real** con
  `authenticateTokenJwt` y el limitador mockeados: fija que el usuario sale de la sesión y no del
  cuerpo, que una petición sin cuerpo vale, que el `429` llega con `meta.retry_after_seconds` y
  que sin `req.user` el controller corta con `401 UNAUTHENTICATED` antes de llamar al service.
