# `GET /auth/me` — el porqué

Endpoint 4 del contrato (`04_contrato_api_auth.md` §4.4): devuelve el usuario de la sesión.
Es la llamada que sostiene el guard `<Auth>` del frontend, así que corre en cada carga de página
protegida y cada milisegundo y cada consulta de más se pagan multiplicados.

## 1. El recorrido

```text
GET /api/v1/auth/me
  → authenticateTokenJwt              Bearer → firma → sesión viva en BD → req.user
  → getMeController                   usuario → parse → service → sobre
  → getMeSchema.parse({ user_id })    valida la entrada del service
  → getMeService                      regla: sin fila de usuario, 404
  → findSessionUser                   data/: findUserById, select explícito sin hash
  → toApiUser                         modelo del contrato §2, campo a campo
  → 200 { … data: { user } }
```

| Paso | Archivo |
| --- | --- |
| cadena de middlewares | `presentation/get_me.routes.ts:9` |
| usuario → validación → service → respuesta | `presentation/get_me.controller.ts:11-13` |
| regla de negocio | `presentation/get_me.service.ts:10-20` |
| persistencia | `data/get_me.repository.ts:4-5` |

## 2. La entrada no viene del cliente, y por eso se valida distinto

El cliente no manda nada: ni cuerpo, ni parámetros de ruta, ni query. **El único dato de entrada
es el `sub` del JWT**, que `authenticateTokenJwt` ya convirtió en `req.user`
(`src/middlewares/authenticate_token_jwt.ts:55`).

Por eso el controller construye el payload con `authenticated_user.id`
(`presentation/get_me.controller.ts:12`) y **nunca** con `req.query` ni `req.body`. Es la
diferencia entre `/me` y un `/users/:id`: si el id viniera del cliente, este endpoint sería una
fuga de datos de cualquier usuario con solo cambiar un número. El test
`test/get_me.controller.test.ts` fija esa propiedad mandando `?user_id=usr_ajeno` y comprobando
que el service recibe `usr_1`.

`getMeSchema` (`domain/get_me.schema.ts:5-7`) valida entonces el **contrato de entrada del
service**, no el de la petición. Existe por dos razones concretas y no por ceremonia: mantiene el
orden fijo del controller (`02_reglas_backend.md` §3) idéntico al de los slices que sí reciben
cuerpo, y deja el `GetMePayload` derivado del schema
(`domain/get_me.payload.ts:5`) como el único tipo que el service acepta, en vez de un `string`
suelto que cualquiera puede confundir con un `session_id`. El mensaje es una clave i18n
(`ValidationKeys.common.required`) porque el manejador global copia `issue.message` a
`meta.fields` y descarta lo que no tenga forma de clave
(`src/middlewares/error_handler.ts:43`).

## 3. Por qué hay una segunda consulta a `users`

`authenticateTokenJwt` ya trae la sesión **con** cuatro campos del usuario en la misma consulta
(`src/modules/auth/shared/data/sessions.repository.ts:16-21`): `id`, `email`, `role` y
`email_verified_at`. Son los que necesita `req.user`, y son **cuatro de los doce** que el contrato
§2 exige en la respuesta: faltan `full_name`, `organization`, `is_independent`, `city`,
`city_other`, `avatar_url`, `auth_provider` y `created_at`.

Las dos salidas eran ampliar el `select` del middleware —y pagar los ocho campos extra en **cada**
petición autenticada de todo el backend, no solo en `/me`— o hacer una segunda lectura por clave
primaria **solo aquí**. Se eligió la segunda: `/me` es el único endpoint que necesita el modelo
completo, y un `findUnique` por `id` es la consulta más barata que existe contra esa tabla.

## 4. `data/` delega en el repositorio compartido, y no duplica el `select`

`findSessionUser` (`data/get_me.repository.ts:4-5`) llama a `findUserById`
(`src/modules/auth/shared/data/users.repository.ts:49`). No repite la consulta con un `select`
propio, y esa es una decisión deliberada:

- `AUTH_USER_SELECT` (`src/modules/auth/shared/data/users.repository.ts:9-22`) es **la** lista de
  los doce campos del contrato §2, y **no incluye `password_hash`**. Copiarla aquí crearía una
  segunda lista que puede divergir el día que alguien añada una columna a `users`. En un módulo de
  auth, dos listas explícitas que deberían ser iguales son peor que una;
- el propio `shared/docs/README.md` §4 lo instruye literalmente: *"`findUserById` no trae el hash:
  es la consulta de `GET /me`"*;
- el archivo se mantiene porque es la **frontera de datos del slice**: el service importa un nombre
  de su propio vocabulario y los tests tienen un único path que mockear
  (`test/get_me.service.test.ts:11-13`), sin conocer la superficie compartida.

El precio es una indirección de dos líneas. Si el integrador prefiere que el service importe
`findUserById` directamente, el cambio es borrar este archivo y una línea de import.

## 5. El `404` que casi nunca ocurre

`getMeService` lanza `404 NOT_FOUND` si `findSessionUser` devuelve `null`
(`presentation/get_me.service.ts:13-17`). En la práctica ese camino es casi inalcanzable: la FK de
`auth_sessions.user_id` es `onDelete: Cascade` (`prisma/schema/auth.prisma:12`), así que borrar el
usuario borra sus sesiones y el middleware habría fallado antes con `SESSION_EXPIRED`.

Se sostiene igualmente porque la alternativa es peor: sin ese `if`, `toApiUser(null)` reventaría
con un `TypeError` y el manejador global lo traduciría a un `500 INTERNAL_ERROR` —culpando al
servidor de un estado de datos— en vez de al `404 NOT_FOUND` que el contrato §5 ya define. El
código sale de `ErrorCodes.NOT_FOUND` y el texto de `AuthMessages.user.not_found`; cero strings
sueltos.

## 6. La respuesta

`200` con el sobre de `buildHttpResponse` y `data: { user }`
(`presentation/get_me.controller.ts:15-22`). **Va envuelto en `user`**, no plano, porque el
contrato §4.4 dice `data: { user }` y porque deja sitio a añadir hermanos (`permissions`,
`unread_count`) sin romper el adaptador del frontend.

Sin `meta`: el sobre solo lo incluye cuando hay algo que ramificar
(`src/utils/build_http_response.ts:47-49`), y una lectura correcta no ramifica.

El `user` sale de `toApiUser` (`src/modules/auth/shared/domain/user_mapper.ts:3`), que construye
el modelo campo a campo y serializa las fechas a ISO 8601. Es la segunda barrera contra
`password_hash`, después del `select`; `test/get_me.service.test.ts` comprueba que la respuesta no
lleva esa clave.

## 7. Los tests

`test/get_me.service.test.ts` mockea `data/get_me.repository` por su path exacto
(`02_reglas_backend.md` §10) y fija: que consulta por el id del payload, la forma del contrato con
fechas ISO, la ausencia de `password_hash` y el `404 NOT_FOUND` con su `meta.code`.

`test/get_me.controller.test.ts` monta el **router real** en una app de Express con Supertest,
con `authenticateTokenJwt` y el service mockeados. Así cubre lo que un test de función suelta no
ve: que el router usa `GET` y no `POST`, que el middleware va delante del controller, que el sobre
llega serializado con `path` y `message`, y que —al no haber `try/catch`— el `AppError` del service
sale por el manejador global con su código. Se usa Supertest en vez de un `res` falso porque
fabricar un `Response` de Express a mano exige un cast, y los casts están prohibidos
(`01_reglas_globales.md` §4).
