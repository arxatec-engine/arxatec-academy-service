# `POST /auth/logout` — el porqué

Endpoint 3 del contrato (`04_contrato_api_auth.md` §4.3): revoca la sesión en curso, responde
`200` sin cuerpo y es **idempotente**.

## 1. El recorrido

```text
POST /api/v1/auth/logout
  → authenticateRevocableSession         Bearer → firma → sesión en BD (aunque esté revocada)
  → logoutController                     usuario → parse → service → sobre
  → logoutSchema.parse({ session_id })   valida la entrada del service
  → logoutService                        traduce "filas tocadas" a already_revoked
  → revokeCurrentSession                 data/: revokeSession, UPDATE por id
  → 200 sin data
```

| Paso | Archivo |
| --- | --- |
| cadena de middlewares | `presentation/logout.routes.ts:9` |
| usuario → validación → service → respuesta | `presentation/logout.controller.ts:11-13` |
| regla de negocio | `presentation/logout.service.ts:5-9` |
| persistencia | `data/logout.repository.ts:3-4` |

## 2. La sesión que se cierra sale del token, nunca del cuerpo

El controller construye el payload con `authenticated_user.session_id`
(`presentation/logout.controller.ts:12`), que es el `jti` del JWT que el middleware ya validó
(`src/middlewares/authenticate_token_jwt.ts:55`). El cuerpo de la petición **no se lee**.

No es un detalle de estilo: si el `session_id` viniera del cliente, cualquier usuario autenticado
podría cerrar la sesión de otro mandando su id, que es una denegación de servicio de una línea.
El test `test/logout.controller.test.ts` manda `{ session_id: 'ses_ajena' }` en el cuerpo y
comprueba que el service recibe `ses_1`.

Por eso el endpoint tampoco necesita un cuerpo, y por eso `logoutSchema`
(`domain/logout.schema.ts:5-7`) valida el **contrato de entrada del service** y no el de la
petición: mantiene el orden fijo `usuario → validación → service → respuesta`
(`02_reglas_backend.md` §3) y da al service un `LogoutPayload` con nombre
(`domain/logout.payload.ts:5`) en vez de un `string` que se confunde con un `user_id`.

## 3. La idempotencia: dónde está de verdad y dónde no llega

El contrato exige que **una sesión ya revocada responda `200`, no error**. Este slice cumple su
mitad:

`revokeSession` usa `updateMany` con `where: { id, revoked_at: null }`
(`src/modules/auth/shared/data/sessions.repository.ts:59-62`) y devuelve `count`. `updateMany` no
lanza `P2025` cuando no encuentra fila: devuelve `0`. `logoutService`
(`presentation/logout.service.ts:5-9`) traduce ese `0` a `already_revoked: true` y **resuelve**;
no hay ningún camino en el que este service lance. El filtro `revoked_at: null` además impide que
una segunda revocación pise la fecha de la primera.

La otra mitad la pone la cadena de la ruta. `authenticateTokenJwt` rechaza las sesiones revocadas
**antes** de llegar al controller (`isSessionRevoked` → `401 SESSION_EXPIRED`), lo que dejaba el
segundo `POST /auth/logout` en `401` y contradecía el §4.3. La integración de la fase 4.10 lo
resolvió partiendo el middleware en una fábrica con una sola opción,
`createSessionAuthenticator({ allow_revoked_session })`
(`src/middlewares/authenticate_token_jwt.ts:33-58`), y montando en esta ruta —y **solo** en esta—
la variante tolerante `authenticateRevocableSession` (`presentation/logout.routes.ts:9`).

> **Qué sigue rechazando la variante tolerante.** Todo lo demás: firma inválida, emisor distinto,
> `jti` que no existe, `sub` que no coincide con el dueño de la sesión y sesión **caducada**
> (`expires_at` pasado → `401 SESSION_EXPIRED`). Lo único que deja pasar es `revoked_at !== null`,
> que es exactamente el caso que el §4.3 llama idempotente. La autoridad sigue siendo la base de
> datos, no el JWT.

## 4. Por qué el resultado del service es un booleano y no una descripción

`logoutService` devuelve `{ already_revoked }` (`domain/logout.types.ts`), no un texto. El service
no conoce Express **ni el idioma**: elegir entre `AuthMessages.logout.success` y
`AuthMessages.logout.already_revoked` es una decisión de presentación y vive en el controller
(`presentation/logout.controller.ts:18-20`).

Ese booleano no viaja al cliente. El contrato §5 no define ningún `meta.code` para "ya estaba
cerrada" y el §4.3 pide respuesta sin cuerpo, así que inventar uno sería cambiar el contrato por
un caso que al frontend no le cambia nada: en los dos escenarios borra el token y navega a
`/ingresar`. Lo único que cambia es `description`, que es texto para humanos y que el frontend
tiene prohibido comparar (§1).

## 5. `data/` delega en el repositorio compartido

`revokeCurrentSession` (`data/logout.repository.ts:3-4`) llama a `revokeSession`
(`src/modules/auth/shared/data/sessions.repository.ts:58`). La revocación de una sesión la usan
también el reset de contraseña (`revokeAllUserSessions`) y el propio middleware, así que la
consulta vive en `shared/` por la política de código compartido (`02_reglas_backend.md` §9.2) y
aquí queda solo la frontera de datos del slice: un nombre en el vocabulario de este endpoint y un
único path que mockear en los tests (`test/logout.service.test.ts:5-7`). Si el integrador prefiere
importar `revokeSession` directamente desde el service, se borra este archivo y una línea de
import.

## 6. La respuesta

`200` con el sobre de `buildHttpResponse` y **sin `data`**
(`presentation/logout.controller.ts:15-23`). No es `204 No Content` porque el contrato §1 exige el
mismo sobre en **todas** las respuestas, y un `204` no tiene cuerpo donde ponerlo; el frontend
parsea siempre lo mismo. Tampoco lleva `meta` — el sobre solo lo incluye si se le pasa
(`src/utils/build_http_response.ts:47-49`).

## 7. Sin rate limit, a propósito

El contrato §6 no define límite para `/auth/logout` y este slice no inventa uno. La ruta ya exige
un JWT válido cuya sesión existe en la base, y el trabajo que hace es un `UPDATE` por clave
primaria que a la segunda vez ni siquiera toca una fila. Está razonado en `../../docs/README.md` §4.

## 8. Los tests

`test/logout.service.test.ts` mockea `data/logout.repository` por su path exacto y fija las tres
cosas que importan: que revoca el id del payload, que `count: 1` da `already_revoked: false` y que
`count: 0` **resuelve** con `already_revoked: true` en vez de lanzar.

`test/logout.controller.test.ts` monta el **router real** con Supertest y el middleware y el
service mockeados: comprueba el verbo `POST`, que `authenticateRevocableSession` va delante, el sobre sin `data` ni
`meta`, la descripción distinta en el caso idempotente, el `401 UNAUTHENTICATED` cuando no hay
`req.user` y que el `session_id` que llega al service es el del token y no el del cuerpo. Supertest
en vez de un `res` falso porque fabricar un `Response` de Express a mano exige un cast, prohibido
por `01_reglas_globales.md` §4.

## 9. El camino completo, contra PostgreSQL real

`tests/integration/postgres/auth_flow.test.ts` cierra el hueco que ningún test unitario cubre: que
el segundo `POST /auth/logout` con el **mismo token** responde `200` contra la base real, y que el
reset de contraseña revoca la sesión abierta antes de él.
