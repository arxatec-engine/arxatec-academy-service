# `auth/google_login/start` — el porqué

**Endpoint 9 del contrato: `GET /api/v1/auth/google` → `302` a Google.** No devuelve JSON: su
respuesta es una redirección con el `redirect_to` del usuario firmado dentro del `state` de
OAuth (`04_contrato_api_auth.md` §4.9-11 y §7.2).

```text
domain/        start.schema.ts  start.payload.ts  start.types.ts
presentation/  start.service.ts  start.controller.ts  start.routes.ts
test/          start.service.test.ts  start.controller.test.ts
```

No hay `data/`: este slice no lee ni escribe nada. El porqué está en el README de la feature §6.

## 1. El flujo, de punta a punta

| Paso | Dónde | Qué pasa |
| --- | --- | --- |
| Entrada | `presentation/start.routes.ts:8` | `GET /google`, sin middlewares delante |
| Validación | `presentation/start.controller.ts:10` | `googleStartSchema.parse(req.query)` — la query, no el body |
| Reglas | `presentation/start.service.ts:6-15` | normaliza el destino y lo firma dentro del state |
| Cookie | `presentation/start.controller.ts:14` | `setOauthStateNonceCookie` ata el state a este navegador (feature §8) |
| Traza | `presentation/start.controller.ts:16-19` | `logger.info` con `request_id` y destino |
| Salida | `presentation/start.controller.ts:21` | `redirectToGoogle(state)` devuelve el handler de Passport, que emite el `302` |

El controller **no lleva `try/catch`** (`02_reglas_backend.md` §3). Es síncrono, y Express 5
también recoge el `throw` de un handler síncrono: tanto el `ZodError` del `parse` como el
`AppError` de Passport cuando faltan credenciales llegan al manejador global
(`src/middlewares/error_handler.ts:121`) y salen con el sobre de siempre. Está fijado en el último
caso de `test/start.controller.test.ts`.

**La cookie se pone antes de delegar en Passport** y no después: Passport escribe la respuesta
(`302`) y, una vez enviadas las cabeceras, `res.cookie` ya no llega a ningún sitio.

## 2. Quién emite el `302`, y por qué no lo emite el controller

Lo emite Passport (`src/config/passport.ts:100-108`), no `res.redirect`. La URL de autorización
de Google no es una constante: lleva `client_id`, `redirect_uri`, `scope`, `response_type` y el
`state`, y construirla a mano sería reimplementar `passport-oauth2` con peor mantenimiento.

Lo que sí decide este slice es **qué `state` viaja**, y por eso el controller pasa por el
service antes de delegar. `redirectToGoogle` recibe el state ya firmado y no sabe nada del
`redirect_to`.

`session: false` (`src/config/passport.ts:105`) es obligatorio: no hay `express-session`
montado en `createApp` (la sesión vive en `auth_sessions`, D-004). Sin ese flag, Passport
intentaría serializar en `req.session` y reventaría en la vuelta.

## 3. La validación: `redirect_to` se rechaza, no se corrige

`domain/start.schema.ts:8-12` valida el único campo de la query:

| Campo | Regla | Clave i18n |
| --- | --- | --- |
| `redirect_to` | opcional · `max 512` · `isSafeRedirect` | `auth.errors.redirect_to_invalid` |

Un destino con esquema (`https://malo.pe`), con `//` o sin barra inicial no cae al inicio en
silencio: **sale un `422 VALIDATION_ERROR`** con `meta.fields.redirect_to`
(`test/start.controller.test.ts:89-104`). Es lo que dice el contrato §7.1 —"**se rechaza**
cualquier valor con esquema, `//` o host"— y también lo más útil: si la SPA está mandando un
destino inválido, un `422` sale en su consola de red y un silencio no.

El predicado es `isSafeRedirect` (`src/utils/safe_redirect.ts:17`), la misma función pura que
usan el correo de recuperación y el enlace de verificación. Una sola implementación testeada
(26 casos) y no tres regex parecidas.

**El mensaje del schema es una clave i18n, no prosa**: el manejador global copia
`issue.message` a `meta.fields` y descarta lo que no tenga forma de clave
(`src/middlewares/error_handler.ts:43`), así que un texto en español acabaría convertido en
`errors.validation.invalid`. Sale de `ValidationKeys` (`src/constants/validation_keys.ts:49`).

## 4. El service vuelve a sanear lo que el schema ya validó

`presentation/start.service.ts:7` llama a `sanitizeRedirect` **después** de que el schema haya
aceptado el valor. No es redundante por dos motivos distintos:

1. **Es lo que convierte el `undefined` en `/`.** El campo es opcional; sin este paso habría que
   decidir el destino por defecto en el controller o dentro del state, y `FrontendRoutes.home`
   estaría escrito en dos sitios (`src/utils/safe_redirect.ts:33`).
2. **Es la garantía del service, no del schema.** El service es público dentro del proceso: su
   test lo llama con `'https://malo.pe/phishing'` directamente
   (`test/start.service.test.ts:20-25`) y comprueba que lo que se firma es `/`. Si mañana otro
   punto de entrada lo invoca sin pasar por Zod, la promesa "nunca se firma un destino externo"
   sigue en pie.

`signOauthState` remata con un tercer control (`shared/domain/oauth_state.ts:86-90`): lanza si el
destino no es seguro en vez de firmarlo. Tres capas para lo mismo, porque **lo que está en juego
es que la URL de Arxatec lleve a otro sitio**.

## 5. Qué hay dentro del `state`

`{ redirect_to, nonce, issued_at }` en base64url, más una firma HMAC-SHA256 separada por un
punto (`shared/domain/oauth_state.ts:92-103`).

- **No está cifrado, está firmado.** El destino es un path que el propio usuario acaba de
  escribir en su barra de direcciones: esconderlo no protege de nada. Lo que hace falta es que
  no se pueda **cambiar**, y eso lo da la firma.
- **La clave es `env.JWT_SECRET` con un contexto propio** (`:13`, `:45-48`). El contexto
  (`arxatec.academy.google.oauth.state.v1`) es lo que impide que un state valga como token de
  otra cosa firmada con el mismo secreto: la separación de dominios es gratis y el día que
  alguien firme otro artefacto con `JWT_SECRET` ya está resuelta.
- **El `nonce`** (16 bytes aleatorios) hace dos cosas. Una: que dos arranques con el mismo destino
  y el mismo segundo den states distintos. Y la de verdad importante: **es lo que ata el state a
  este navegador**. `signOauthState` lo devuelve aparte del state (`SignedOauthState`,
  `oauth_state.ts:30-33`) precisamente para que el controller pueda guardarlo en una cookie
  `HttpOnly` y el callback exija que coincida — sin eso, un state válido de un atacante abierto por
  la víctima le dejaba la sesión de otra persona (README de la feature §8). El nonce **nunca**
  viaja en la URL de Google: solo en la cookie y, firmado, dentro del state.
- **`issued_at`** lo caduca a los 10 minutos (`AuthPolicy.oauth_state_max_age_seconds`,
  `src/constants/auth.ts:25`, la misma cifra que el `Max-Age` de la cookie), que es tiempo de sobra para escribir una contraseña de Google y
  poco para reutilizar un state encontrado en un log.

## 6. Los tests

`test/start.service.test.ts` (5 casos) no mockea nada: el service es puro y su colaborador
—`oauth_state`— es puro también. Comprueba el viaje de ida y vuelta con `verifyOauthState`, que
es la única forma honesta de afirmar "el destino va dentro del state": mirar el string firmado
no diría nada.

`test/start.controller.test.ts` (9 casos) monta una app Express mínima con el manejador global
real y **mockea `@/config/passport` por su path exacto** (`:14`), que es el módulo que importa la
implementación (`02_reglas_backend.md` §10). Sin ese mock, el test necesitaría credenciales de
Google. El doble devuelve un handler que redirige a una URL de Google falsa con el state en la
query, y de ahí el test lo recupera y lo verifica de verdad.

Cubre además tres cosas que el service no puede ver: que **el destino no viaja en claro en la URL
de Google**, que la respuesta trae la cookie del nonce con `HttpOnly`, `SameSite=Lax`, su `Path` y
su `Max-Age`, y que un fallo de Passport sale como `500 INTERNAL_ERROR` sin tumbar nada.

El controller se monta **suelto**, sin `googleStartRouter`: es la convención del módulo para no
arrastrar el estado compartido de los limitadores entre archivos de test. La cadena de la ruta
—que aquí es una sola línea sin middlewares— le toca al test de integración.
