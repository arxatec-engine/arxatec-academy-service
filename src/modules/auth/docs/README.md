# `modules/auth` — el mapa del módulo

Único módulo del backend hoy. Cubre los **11 endpoints** del contrato
(`harness/04_contrato_api_auth.md` §4) repartidos en 6 features y 9 actions, más la superficie
compartida del módulo (`shared/`).

## 1. Dónde se monta cada cosa

```text
src/routes/index.ts:12       routes.use(`${ApiPrefix}${AuthRoutePrefix}`, authRouter)   -> /api/v1/auth
src/modules/auth/index.ts    authRouter.use(<router de cada feature>)
features/<f>/index.ts        compone los routers de sus actions
features/<f>/<a>/presentation/<a>.routes.ts   declara el path y la cadena de middlewares
```

**El prefijo se pone una sola vez**, en `src/routes/index.ts:12`. Ningún router de feature ni de
action lleva prefijo propio: todos declaran su path completo relativo a `/auth` desde
`AuthEndpoints` (`src/constants/endpoints.ts:9-21`), y por eso todos se montan con `.use()` sin
argumento de ruta (`src/modules/auth/index.ts:12-17`). La consecuencia práctica: para saber la URL
de un endpoint basta leer su `*.routes.ts`; no hay que reconstruirla sumando tres prefijos.

| Feature | Router | Endpoints |
| --- | --- | --- |
| `registration` | `registerRouter` | `POST /register` |
| `email_login` | `loginRouter` | `POST /login` |
| `session` | `sessionRouter` | `POST /logout`, `GET /me` |
| `password_reset` | `passwordResetRouter` | `POST /password/forgot`, `POST /password/reset` |
| `email_verification` | `emailVerificationRouter` | `POST /email/verify`, `POST /email/resend` |
| `google_login` | `googleLoginRouter` | `GET /google`, `GET /google/callback`, `POST /google/exchange` |

## 2. Por qué el orden de montaje no decide nada aquí (y qué lo decidiría)

Los 11 paths son **estáticos**: no hay ningún segmento dinámico (`/:id`) en todo el módulo, y
Express 5 casa las rutas de un `Router` por igualdad exacta del path restante. `GET /google` y
`GET /google/callback` conviven sin ambigüedad porque son dos rutas distintas, no un prefijo y su
hijo.

> **La trampa que sí existiría** el día que aparezca un path dinámico: si alguien añade
> `GET /:token` en una feature montada antes que `session`, se comería `GET /me`. La regla, cuando
> llegue ese día, es la de siempre — **la ruta estática se monta antes que la dinámica**— y el sitio
> donde se aplica es este archivo, porque el orden real de resolución es el orden de las líneas
> `authRouter.use(...)` de `src/modules/auth/index.ts:12-17`, no el de los `*.routes.ts`.

El orden actual es el del contrato (registro → login → sesión → recuperación → verificación →
Google), elegido para que leer el archivo sea leer el flujo del producto.

## 3. Autenticación: dos variantes, y solo dos

| Middleware | Dónde | Qué deja pasar de más |
| --- | --- | --- |
| `authenticateTokenJwt` | `GET /me`, `POST /email/resend` | nada |
| `authenticateRevocableSession` | `POST /logout` y solo ahí | una sesión con `revoked_at` puesto |

Las dos salen de la misma fábrica, `createSessionAuthenticator`
(`src/middlewares/authenticate_token_jwt.ts:33-58`), con una única opción de diferencia. La razón
está en `features/session/logout/docs/README.md` §3: el contrato §4.3 exige que el segundo
`POST /auth/logout` responda `200`, y el rechazo de sesiones revocadas lo convertía en `401`.
Todo lo demás —firma, emisor, `jti` inexistente, `sub` que no cuadra, sesión caducada— lo
siguen rechazando las dos por igual: **la autoridad es la fila de `auth_sessions`, no el JWT**
(contrato §3).

Los tres endpoints públicos que consumen un token de un solo uso (`email/verify`,
`password/reset`, `google/exchange`) no llevan middleware de sesión: su credencial **es** el token
del cuerpo, y se busca por su SHA-256 (`src/infrastructure/tokens/one_time_token.ts:11-12`).

## 4. Límites de peticiones: los del contrato, ninguno inventado

La tabla del contrato §6 está cableada en `AuthRateLimits` (`src/constants/auth.ts:28-38`) y se
instancia en `src/middlewares/rate_limit.ts:66-112`. Cada `*.routes.ts` monta el suyo delante del
controller.

| Endpoint | Limitador | Clave |
| --- | --- | --- |
| `POST /login` | `loginByIpRateLimit` 30/15 min + `loginByAccountRateLimit` 10/15 min | IP · IP + correo |
| `POST /register` | `registerRateLimit` 5/h | IP |
| `POST /password/forgot` | `passwordForgotByIpRateLimit` 5/h + `passwordForgotByEmailRateLimit` 3/h | IP · correo |
| `POST /password/reset` | `passwordResetRateLimit` 20/h | IP |
| `POST /email/verify` | `emailVerifyRateLimit` 20/h | IP |
| `POST /email/resend` | `emailResendRateLimit` 5/h + cooldown de 45 s | usuario |
| `POST /google/exchange` | `googleExchangeRateLimit` 20/h | IP |
| `GET /me`, `POST /logout`, `GET /google`, `GET /google/callback` | **ninguno** | — |

`/login` y `/password/forgot` llevan **dos cubos cada uno** —uno por IP y otro por cuenta—, que es
la lectura del §6 que se registró el 2026-08-20: un solo cubo compuesto (IP + correo) no pone
ningún techo a quien rota el correo, y un solo cubo por IP castiga a una oficina detrás de un NAT.

Las cuatro rutas sin límite son las cuatro que el contrato §6 no lista. No se les inventó uno:
en `/me` sería además dañino, porque es la llamada del guard en cada carga de página y un límite
por IP castigaría a una oficina entera detrás del mismo NAT (`features/session/docs/README.md` §4).

> **Lo que estos límites no son.** Viven en memoria del proceso
> (`02_reglas_backend.md` §2, decisión D-002): con dos instancias, cada cubo se multiplica por el
> número de procesos. Y `express-rate-limit` v8 ya no expone `req.rateLimit`, así que el
> `Retry-After` que sale es la **ventana completa**, no lo que resta
> (`src/middlewares/rate_limit.ts:55`).

## 5. Qué comparten los slices y qué no

`shared/` (su propio README) publica lo que usan varias actions: los dos repositorios
(`users`, `auth_sessions`), el mapper que construye el usuario del contrato, la normalización del
correo y la política de sesión. **`auth_tokens` no tiene repositorio compartido**: cada action
escribe su propia consulta sobre esa tabla (registro, reenvío, verificación, recuperación, reset,
callback de Google y canje). Es la deuda declarada más grande del módulo y está anotada como tal en
`docs/ARCHITECTURE.md` §6; consolidarla es mover siete consultas y reescribir los mocks de cinco
slices, no una línea.

## 6. Los flujos completos

Los tres caminos de punta a punta —registro → verificación → logout → login → recuperación →
reset → login con la clave nueva— están ejercitados contra PostgreSQL real en
`tests/integration/postgres/auth_flow.test.ts`. Es el único sitio donde se comprueba que las
transacciones de `auth_tokens` y la revocación en cascada del reset hacen lo que sus tests
unitarios simulan con mocks.
