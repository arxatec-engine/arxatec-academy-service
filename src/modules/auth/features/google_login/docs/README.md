# `features/google_login` — el porqué

Los **endpoints 9, 10 y 11** del contrato (`04_contrato_api_auth.md` §4), que son las tres
patas de un mismo rodeo: el navegador sale hacia Google, vuelve al backend y el frontend canjea
lo que trajo.

| # contrato | Método | Ruta | Slice | Devuelve |
| --- | --- | --- | --- | --- |
| 9 | `GET` | `/auth/google` | `start/` | `302` a Google |
| 10 | `GET` | `/auth/google/callback` | `callback/` | `302` a `${FRONTEND_URL}/oauth/callback?code=…&redirect_to=…` |
| 11 | `POST` | `/auth/google/exchange` | `exchange/` | `200` con `{ token, expires_at, user }` |

```text
shared/domain/oauth_state.ts      firma y verifica el state (lo usan start y callback)
shared/utils/oauth_state_cookie.ts  pone y retira la cookie del nonce (lo usan start y callback)
start/                            domain + presentation                (no tiene data/: no toca la base)
callback/                         domain + data + presentation + utils
exchange/                         domain + data + presentation
index.ts                          googleLoginRouter, que compone los tres
```

## 1. Por qué son tres endpoints y no uno

El corte no es arbitrario: **cada slice ocurre en un contexto de seguridad distinto**.

`start` corre en el navegador del usuario y no sabe todavía quién es nadie. `callback` corre en
el navegador pero lo dispara **Google**, no la SPA: llega como navegación de nivel superior, sin
cabecera `Authorization`, sin poder leer una respuesta JSON y sin poder guardar nada en
`localStorage`. `exchange` es la primera llamada que hace **la SPA misma**, con `fetch`, y por
eso es la única que puede recibir un JWT y guardarlo.

De ahí sale la decisión D-005 (`08_decisiones.md`) y el bloque destacado del contrato §4:
**el callback no puede devolver el token, así que devuelve un código opaco**. Un JWT en la URL
queda en el historial del navegador, en la cabecera `Referer` de la siguiente petición y en el
log de cualquier proxy intermedio. El código dura 60 s
(`AuthTokenTtlSeconds.oauth_exchange_code`, `src/constants/auth.ts:6`), sirve una sola vez y no
vale para nada más que para pedir la sesión.

## 2. El `redirect_to` da la vuelta entera sin tocar la query de Google

Es la promesa del brief ("vuelves justo aquí") aplicada al único flujo donde el frontend
**pierde el control de la navegación**: al salir hacia `accounts.google.com` no queda nadie
guardando nada en `sessionStorage`, porque la pestaña ya no es la SPA.

```text
GET /auth/google?redirect_to=/curso/x
  → isSafeRedirect  → firma HMAC → state (redirect_to + nonce + issued_at)
  → Set-Cookie: arxatec_oauth_state=<nonce>; HttpOnly; SameSite=Lax
  → 302 accounts.google.com/...?state=<firmado>
Google vuelve
  → lee y borra la cookie → verifica firma, edad y nonce → recupera /curso/x
  → 302 ${FRONTEND_URL}/oauth/callback?code=…&redirect_to=/curso/x
```

**El destino se valida ANTES de firmarlo** (`shared/domain/oauth_state.ts:86-90`) y **otra vez
al abrirlo** (`:135-137`). La primera comprobación es la que impide que este endpoint sea un
redirector abierto: sin ella, `/auth/google?redirect_to=https://malo.pe` sería un enlace con el
dominio de Arxatec en la barra que acaba en un sitio de phishing, que es exactamente el ataque
que describe el contrato §7.1. La segunda es defensa en profundidad: cubre el día en que la
clave HMAC se filtre o alguien añada otra forma de construir un state.

**El state es la única maleta que hace el viaje.** No se pasa el destino como query param a
Google (Google lo devolvería, pero cualquiera podría cambiarlo por el camino) ni se guarda en
memoria del proceso: firmado y sin estado funciona igual con dos instancias detrás de un
balanceador, que es justo lo que D-002 no puede prometer del rate limit. Lo único que se guarda en
el navegador es el **nonce** (§8), que no es dato: es la prueba de que quien vuelve es quien salió.

## 3. `shared/` de feature: por qué existe

`oauth_state.ts` y `oauth_state_cookie.ts` los usan **dos actions de esta feature y solo de esta
feature**: `start` firma y pone la cookie, `callback` la retira y verifica. La política de código compartido (`02_reglas_backend.md` §9) dice que lo que
se usa en varias actions sube al nivel que las contiene; el nivel más pequeño que contiene a las
dos es la feature, no el módulo. Subirlo a `modules/auth/shared/` lo ofrecería a los once slices
del módulo cuando solo dos lo pueden usar, y ese directorio es superficie compartida que este
slice tiene prohibido tocar.

`oauth_state.ts` es puro (firma, verifica, no toca `req`/`res`); `oauth_state_cookie.ts` es el
único que conoce Express, y por eso vive en `utils/` y no en `domain/`: la cookie es transporte
HTTP, no dominio.

Su test vive en `shared/test/oauth_state.test.ts` (26 casos): formato, firma manipulada, payload
manipulado, vencimiento, state del futuro, destinos que no se firman y **el nonce que no
corresponde** (state de otro navegador y callback sin cookie).

## 4. `index.ts` — el router de la feature

`googleLoginRouter` (`index.ts:7-11`) compone los tres routers de slice, sin prefijo propio: los
paths ya son absolutos respecto de `/auth` (`AuthEndpoints.google_start = '/google'`,
`google_callback = '/google/callback'`, `google_exchange = '/google/exchange'`,
`src/constants/endpoints.ts:18-20`) y `authRouter` ya cuelga de `${ApiPrefix}${AuthRoutePrefix}`
(`src/routes/index.ts:12`).

```ts
import { googleLoginRouter } from '@/modules/auth/features/google_login';

authRouter.use(googleLoginRouter);
```

**Esta feature no se monta a sí misma**: la monta el router del módulo
(`src/modules/auth/index.ts:17`), para que dos features escritas en paralelo no se pisen en el
mismo archivo.

El orden en que se montan `start` y `callback` **no importa**, aunque lo parezca:
`GET /google` y `GET /google/callback` son rutas distintas y Express 5 no hace prefijo (una ruta
sin comodín solo casa con su path exacto). Si algún día uno de los dos pasara a
`googleStartRouter.use(...)`, el orden empezaría a importar y `/google` se tragaría el callback.

## 5. Las credenciales de Google no bloquean el arranque

`GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` son **opcionales** en el entorno
(`src/config/env.ts:25-26`), a diferencia de `JWT_SECRET` o `DATABASE_URL`. La consecuencia
está buscada: quien clona el repo puede levantar el servidor, registrarse por correo y correr
los tests sin pedirle credenciales a Google Cloud.

Por eso la estrategia de Passport **se registra la primera vez que se usa, no al importar el
módulo** (`src/config/passport.ts:71-78`). Si faltan las credenciales, el fallo ocurre dentro de
la petición (`:52-59`), sube al manejador global y sale como `500 INTERNAL_ERROR` con el sobre
de siempre; las rutas siguen montadas y el resto del backend sigue en pie. Con un
`passport.use(...)` en el cuerpo del módulo, importar cualquier cosa de auth reventaría el
arranque entero.

`createApp` ya llama a `passport.initialize()` (`src/app/create_app.ts:30`), así que este slice no
añade nada a la cadena global.

## 6. Qué hace cada slice con la base de datos

| Slice | Lee | Escribe |
| --- | --- | --- |
| `start` | nada | nada |
| `callback` | `oauth_accounts`, `users` | `users` (alta o `email_verified_at`), `oauth_accounts`, `auth_tokens` |
| `exchange` | `auth_tokens`, `users` | `auth_tokens.consumed_at`, `auth_sessions` |

`start` no tiene `data/` **a propósito**: firmar un HMAC no necesita persistencia, y crear un
repositorio vacío para cumplir la forma de la carpeta sería ceremonia. Es también lo que hace
que el endpoint 9 no se pueda usar para castigar la base de datos sin autenticación.

## 7. Rate limit: solo lo tiene el 11

El contrato §6 lista un único límite para este flujo: **20 / hora por IP en
`/auth/google/exchange`** (`googleExchangeRateLimit`, `src/middlewares/rate_limit.ts:109-112`,
montado en `exchange/presentation/exchange.routes.ts:9-13`). Los endpoints 9 y 10 van sin
limitador, y no es un olvido:

- `/auth/google` no toca la base de datos ni manda correo; limitarlo castigaría a una oficina
  entera detrás del mismo NAT antes que a nadie.
- `/auth/google/callback` **no lo puede disparar un atacante a voluntad**: hace falta un `state`
  con firma válida, menos de 10 minutos de vida (`AuthPolicy.oauth_state_max_age_seconds`,
  `src/constants/auth.ts:25`), **la cookie con su nonce** y un `code` que Google acepte. El state
  es el limitador.

Añadir límites que el contrato no lista sería inventar contrato.

## 8. El CSRF de login: el `state` está atado al navegador

**El problema que esto cierra.** Un `state` firmado y caducado solo demuestra que la URL la
generó este backend, **no que la pidiera esta persona**. Con eso solo, el ataque era:

1. el atacante entra en `/api/v1/auth/google` y completa el consentimiento con **su** cuenta;
2. intercepta la vuelta a `/auth/google/callback?code=…&state=…` sin dejar que se complete;
3. consigue que la víctima abra esa URL (un enlace en un correo, un `<img>`, una redirección);
4. el callback la acepta —firma correcta, menos de 10 min, destino seguro—, emite el código de un
   solo uso y **la víctima acaba navegando con la sesión de la cuenta del atacante**.

No hay robo de datos hacia fuera; hay algo casi peor: todo lo que la víctima escriba a partir de
ahí (progreso, comentarios, datos que introduzca) va a una cuenta que el atacante controla y puede
leer cuando quiera.

**La atadura.** El `nonce` que ya existía dentro del `state` ahora también sale del backend en una
cookie propia:

| Pieza | Dónde | Detalle |
| --- | --- | --- |
| Emisión | `start/presentation/start.controller.ts:14` → `shared/utils/oauth_state_cookie.ts:29-31` | `arxatec_oauth_state=<nonce>`, `HttpOnly`, `SameSite=Lax`, `Secure` solo en producción, `Path=/api/v1/auth`, `Max-Age` = los 10 min del state |
| Comprobación | `callback/presentation/callback.controller.ts:14-15` → `shared/domain/oauth_state.ts:131-133` | el `nonce` del payload tiene que coincidir con el de la cookie, comparado con `timingSafeEqual` (`:50-58`) |
| Un solo uso | `shared/utils/oauth_state_cookie.ts:33-39` | la cookie se **borra al leerla**, antes de verificar nada: el mismo state no vale dos veces |

Detalles que son decisiones, no defaults:

- **`SameSite=Lax` y no `Strict`.** La vuelta desde `accounts.google.com` es una navegación de
  nivel superior cross-site; con `Strict` el navegador no mandaría la cookie y **el flujo entero
  dejaría de funcionar**. `Lax` la manda exactamente en ese caso y no en peticiones incrustadas.
- **`Secure` atado a `isProduction`** (`oauth_state_cookie.ts:11`): en `http://localhost` una
  cookie `Secure` no se guarda y el login por Google no se podría probar en local.
- **`Path=/api/v1/auth`**: la cookie no viaja en ninguna otra petición de la API.
- **Sin cookie no hay excepción**: un `nonce` vacío es `400 TOKEN_INVALID`
  (`oauth_state.ts:110-112`). Un usuario que bloquee cookies no puede entrar con Google — y esa
  es la elección correcta: el flujo sin atadura es el que acabamos de cerrar.

Lo fija `callback/test/callback.controller.test.ts`: state de otro navegador → `400` sin hablar
con Google, callback sin cookie → `400`, y el `Set-Cookie` de borrado presente en la respuesta.
