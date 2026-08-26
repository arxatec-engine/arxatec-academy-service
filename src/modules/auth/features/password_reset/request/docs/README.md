# `auth/password_reset/request` — `POST /auth/password/forgot`

Endpoint 5 del contrato (`harness/04_contrato_api_auth.md` §4.5). Manda el enlace de
recuperación, vence en **1 hora**, es de **un solo uso** y **responde `200` exista o no el
correo**.

```text
POST /api/v1/auth/password/forgot
  { "email": "maria@estudioqp.pe", "redirect_to": "/curso/fundamentos" }   redirect_to opcional
→ 200  { status, message, description, timestamp, path }                   sin data, sin meta
```

## 1. El recorrido

| Paso | Archivo | Qué hace |
| --- | --- | --- |
| límite por IP | `presentation/request.routes.ts:14` | `passwordForgotByIpRateLimit` — 5 / hora |
| límite por correo | `presentation/request.routes.ts:15` | `passwordForgotByEmailRateLimit` — 3 / hora |
| validación | `presentation/request.controller.ts:13` | `requestPasswordResetSchema.parse(req.body)` |
| reglas | `presentation/request.service.ts:27` | `requestPasswordReset(payload)` |
| persistencia | `data/request.repository.ts:26,34` | buscar destinatario · invalidar + emitir |
| respuesta | `presentation/request.controller.ts:17-23` | `buildHttpResponse` con el sobre único |

El controller no lleva `try/catch` (`02_reglas_backend.md` §3): Express 5 reenvía el rechazo de
un handler `async` al manejador global, y el `ZodError` del `.parse` sale como `422`
`VALIDATION_ERROR` con `meta.fields` en `src/middlewares/error_handler.ts:77-83`.

## 2. Los dos limitadores, y por qué hacen falta los dos

El contrato §6 pide **`5 / hora` por IP · `3 / hora` por correo**, y son dos defensas distintas:
el de IP frena a quien barre miles de correos desde un equipo; el de correo frena a quien
bombardea un buzón concreto desde una botnet. Cada uno tapa el hueco que deja el otro, así que
montar solo uno degrada el endpoint en silencio. Ambos salen ya configurados de
`src/middlewares/rate_limit.ts:82-91`, leyendo `AuthRateLimits.password_forgot_by_ip` y
`…_by_email` (`src/constants/auth.ts:29-30`).

**Van antes de la validación** a propósito. `emailKey` (`src/middlewares/rate_limit.ts:39`) lee
`req.body.email` en crudo y le aplica `trim().toLowerCase()`, la misma normalización que
`normalizeEmail` (`src/modules/auth/shared/domain/normalize_email.ts:1`), así que
`Maria@X.pe` y `maria@x.pe` comparten cubo. Si el limitador fuese después del `parse`, una
petición con un correo inválido saldría gratis y el atacante tendría un `422` ilimitado con el
que medir tiempos.

## 3. La indistinguibilidad, que es el punto entero del endpoint

`01_reglas_globales.md` §8.2 y el contrato §4.5 exigen la **misma respuesta y el mismo tiempo**
exista o no la cuenta. Se sostiene en tres piezas:

**a) El mismo texto y el mismo sobre.** El controller construye la respuesta **fuera** del `if`:
no hay rama que pueda cambiar `description`. Sale siempre
`AuthMessages.password_forgot.success` (`src/constants/messages/auth.ts:25`), que ya está
redactado en condicional ("Si el correo existe…"). Y sale **sin `data` y sin `meta`**: cualquier
campo extra es un canal por el que se filtra la existencia de la cuenta. El test
`test/request.controller.test.ts` fija las tres cosas.

**b) Un suelo de tiempo de respuesta.** `waitForResponseFloor` (`utils/response_floor.ts:3`)
espera lo que falte hasta `PASSWORD_FORGOT_MIN_RESPONSE_MS` (`:1`, 400 ms) contando desde el
inicio del service (`presentation/request.service.ts:28,49`). Sin él, la rama del usuario
existente paga dos escrituras y una transacción que la otra no paga, y esa diferencia —decenas
de milisegundos, perfectamente medible desde fuera— convierte el endpoint en el oráculo de
correos que el contrato quiere evitar. El suelo se aplica **en las dos ramas**, dentro del
service y no del controller, porque es una regla del flujo y no de HTTP.

> El suelo solo tapa la diferencia mientras el trabajo real quepa por debajo. Si la base de
> datos se degrada y la rama del usuario existente pasa de 400 ms, la diferencia vuelve a ser
> observable. El arreglo entonces es subir la constante, no quitarla.

**c) El correo no bloquea la respuesta.** `deliverPasswordResetEmail`
(`presentation/request.service.ts:15`) se lanza con `void` (`:42`): el service **no lo espera**.
Con `EMAIL_TRANSPORT=smtp` un envío tarda cientos de milisegundos o segundos, y esperarlo haría
la rama "existe" visiblemente más lenta por mucho suelo que se ponga. Como nadie espera el
resultado, la función se traga su propio fallo y lo escribe con Pino (`:22-24`): un SMTP caído
**no puede** cambiar el código de respuesta, que es justo lo que pide el contrato. El envío
sigue siendo dentro de la petición (D-002: no hay cola), solo que fuera del camino de respuesta.

## 4. El token: qué se guarda y qué se manda

`createOneTimeToken(AuthTokenTtlSeconds.password_reset, now)`
(`presentation/request.service.ts:33`) devuelve tres cosas
(`src/infrastructure/tokens/one_time_token.ts:14`):

| Pieza | Dónde va |
| --- | --- |
| `token` (32 bytes, base64url) | **solo** al correo (`:44`) |
| `token_hash` (SHA-256 hex, 64 caracteres) | a `auth_tokens.token_hash` (`:37`) |
| `expires_at` | `now + 3600 s` (`src/constants/auth.ts:5`) |

El token en claro **nunca toca la base de datos** (`01_reglas_globales.md` §8.3): si se filtra
un volcado, los hashes no sirven para restablecer nada. El ancho de la columna es
`VarChar(64)` (`prisma/schema/auth.prisma:22`), exactamente el del SHA-256 en hexadecimal.
`test/request.service.test.ts` afirma que la cadena en claro no aparece en ninguna llamada al
repositorio.

La hora `now` se calcula **una vez** (`:32`) y se usa para las tres fechas —vencimiento del
nuevo token e invalidación de los viejos—, para que no haya un token que ya venció antes de
existir por culpa de dos `new Date()` distintos.

## 5. Invalidar los tokens anteriores, en una transacción

`replacePasswordResetToken` (`data/request.repository.ts:34`) hace dos cosas dentro de un
`prisma.$transaction` (`:37`):

1. `updateMany` de todos los `PASSWORD_RESET` **sin consumir** de ese usuario, marcándolos
   `consumed_at = invalidated_at` (`:38-45`);
2. `create` del nuevo (`:47-55`).

**Por qué `consumed_at` y no una columna nueva.** `auth_tokens` no tiene `invalidated_at`
(`prisma/schema/auth.prisma:18-30`) y el esquema es compartido, así que no se toca desde un
slice. `isTokenUsable` (`src/infrastructure/tokens/one_time_token.ts:24`) exige
`consumed_at === null`, de modo que marcarlo es exactamente "este enlace ya no vale". El precio
es que un enlace invalidado por otro más nuevo y uno realmente usado son indistinguibles en la
tabla; para el flujo de reset da igual, porque los dos casos responden lo mismo
(`400 TOKEN_INVALID`).

**Por qué en transacción y en ese orden.** Sin transacción, un fallo entre las dos operaciones
dejaría al usuario con cero enlaces válidos (molesto pero recuperable) o —si se invirtiera el
orden— con el enlace recién enviado invalidado por su propio `updateMany`, que es un bug que
solo aparece en producción. `$transaction` con callback lo cierra: o quedan los dos efectos o
ninguno.

Consecuencia visible: **pedir el enlace dos veces deja válido solo el último**. Es deliberado —
un buzón comprometido no acumula enlaces vivos— y el frontend no tiene que hacer nada.

## 6. `select` explícito, incluso aquí

`PASSWORD_RESET_RECIPIENT_SELECT` (`data/request.repository.ts:9-12`) trae **`id` y `email`, y
nada más**. Este slice no compara contraseñas, así que no usa
`findUserByEmail` de `shared/data/users.repository.ts:43` —la única consulta del módulo que trae
`password_hash`, y solo porque el login lo necesita—. Traer el hash aquí sería cargarlo en
memoria para no usarlo (`02_reglas_backend.md` §7).

Se trae el `email` de la base en vez de reutilizar el del body (`presentation/request.service.ts:43`):
el enlace va a la dirección **registrada**, con su capitalización real, no a la que escribió
quien hizo la petición.

`ISSUED_PASSWORD_RESET_TOKEN_SELECT` (`:14-17`) devuelve `id` y `expires_at`; el `token_hash` no
vuelve a salir de la base porque nadie lo necesita de vuelta.

## 7. `redirect_to`

Opcional, y validado con la **misma función pura** que usa el resto del backend:
`isSafeRedirect` (`src/utils/safe_redirect.ts:17`), enganchada como `.refine` en
`domain/request.schema.ts:17`. Solo pasan paths que empiezan por `/` y no por `//`, sin
esquema, sin host, sin barra invertida y de 512 caracteres como mucho. Un
`redirect_to=https://malo.pe` convierte el flujo en un redirector abierto y es phishing de
manual (contrato §7.1); aquí se rechaza con `422` y la clave
`ValidationKeys.auth.redirect_to_invalid`, en vez de silenciarse, porque el que lo manda es el
propio frontend y un fallo suyo debe verse.

Hay **dos** filtros, no uno: el schema rechaza la petición, y si algo lo esquivara,
`buildFrontendLink` (`src/infrastructure/email/frontend_link.ts:18`) vuelve a pasar el valor por
`isSafeRedirect` antes de meterlo en el enlace del correo. Un host externo no llega al buzón.

## 8. Validación: por qué el correo se normaliza en el schema

`domain/request.schema.ts:8-13` hace `trim().toLowerCase()` **antes** de validar el formato, y
solo entonces `.pipe(z.email(...))`. Sin ese orden, `"  Maria@X.pe "` fallaría por los espacios
en vez de normalizarse. La columna es `VARCHAR(254) @unique` y **no `citext`**, así que sin la
normalización `Maria@x.pe` no encontraría la fila de `maria@x.pe` y el usuario recibiría el
`200` de siempre sin ningún correo — el peor fallo posible aquí, porque es invisible.
El repositorio vuelve a aplicar `normalizeEmail` (`data/request.repository.ts:30`), igual que
hace `shared/data/users.repository.ts:45`: la garantía no depende de que el llamador se acuerde.

Los mensajes de los schemas son **claves i18n** (`src/constants/validation_keys.ts`), no prosa:
el manejador global copia `issue.message` a `meta.fields` y descarta lo que no tenga forma de
clave (`src/middlewares/error_handler.ts:43`).

## 9. Qué **no** hace este slice

- **No distingue por proveedor.** Una cuenta creada con Google también recibe el enlace. El
  contrato §5 reserva `ACCOUNT_USES_GOOGLE` para el login (§4.2) y no dice nada de este
  endpoint; inventar aquí una rama por `auth_provider` sería añadir contrato por cuenta propia.
  Si el flujo de reset (endpoint 6) decide que un `auth_provider = GOOGLE` no puede fijar
  contraseña, la decisión y su prueba viven allí, no aquí.
- **No revoca sesiones.** Pedir el enlace no cambia nada de la cuenta. Las sesiones se cierran
  al **consumir** el reset (`01_reglas_globales.md` §8.4), en el slice `password_reset/reset`.
- **No devuelve `retry_after_seconds` ni ningún contador.** Eso es del reenvío de verificación
  (contrato §4.8), no de aquí.

## 10. Tests

| Archivo | Qué fija |
| --- | --- |
| `test/request.schema.test.ts` | normalización del correo, `redirect_to` relativo/absoluto, claves i18n |
| `test/request.service.test.ts` | TTL de 1 h, hash y no el token en claro, invalidación con la misma fecha, rama sin usuario, SMTP caído, suelo de tiempo en las dos ramas |
| `test/request.controller.test.ts` | sobre `200` idéntico para correo existente y no existente, sin `data` ni `meta`, `422` con `meta.fields`, error del service al manejador global |
| `test/response_floor.test.ts` | el suelo espera lo que falta y no espera de más |

El test del controller monta un `express()` real con `registerErrorHandler` y ataca por
Supertest **sin los limitadores**: con ellos, la sexta petición del archivo respondería `429` y
el test fallaría por una razón que no tiene nada que ver con lo que prueba. Los mocks apuntan
al **path exacto** que importa la implementación (`02_reglas_backend.md` §10).
