# `features/session` — el porqué

Los dos endpoints que operan sobre la **sesión que ya existe**, no sobre la que se crea:

| # contrato | Método | Ruta | Slice |
| --- | --- | --- | --- |
| 4 | `GET` | `/auth/me` | `get_me/` |
| 3 | `POST` | `/auth/logout` | `logout/` |

Los que **crean** sesión (registro, login, canje de Google) devuelven `ApiSession`
(`src/modules/auth/shared/domain/session.types.ts:24-28`) y viven en otras features. Aquí no se
firma ningún JWT: el token ya llegó y `authenticateTokenJwt` ya lo validó.

## 1. Por qué son dos slices y no uno

Comparten la feature porque comparten el sujeto (la fila de `auth_sessions` en curso) y el
middleware, pero **no comparten nada de lógica**: uno lee `users`, el otro escribe
`auth_sessions.revoked_at`. `02_reglas_backend.md` §3 dice "una action, una responsabilidad", y
un service con una rama `if (action === 'logout')` sería exactamente lo que esa regla prohíbe.
Cada carpeta tiene su schema, su repositorio, su service, su controller, su router y su README.

## 2. `index.ts` — el router de la feature

`sessionRouter` (`src/modules/auth/features/session/index.ts:6-9`) compone los dos routers de
slice. Se monta **una sola vez**, en el router del módulo:

```ts
import { sessionRouter } from '@/modules/auth/features/session';

authRouter.use(sessionRouter);
```

Sin prefijo propio: los paths ya son absolutos respecto de `/auth`
(`AuthEndpoints.me = '/me'`, `AuthEndpoints.logout = '/logout'`,
`src/constants/endpoints.ts:12-13`), y `authRouter` ya cuelga de
`${ApiPrefix}${AuthRoutePrefix}` (`src/routes/index.ts:12`). El resultado es
`GET /api/v1/auth/me` y `POST /api/v1/auth/logout`.

**Esta feature no se monta a sí misma**: la monta el router del módulo
(`src/modules/auth/index.ts:14`), para que dos features escritas en paralelo no se pisen en el
mismo archivo.

## 3. `get_me` no es un verbo canónico, y es a propósito

El vocabulario de `02_reglas_backend.md` §3 dice `get`, no `get_me`. La carpeta se llama `get_me`
porque el sujeto **no** es un recurso que el cliente elige: es el usuario del token, y `session/get`
se leería como "leer la sesión", que es otra cosa (y no existe como endpoint). El nombre largo
evita que el próximo slice de lectura del módulo tenga que llamarse `get_2`.

## 4. Ninguno de los dos lleva rate limit

No es un olvido: el contrato §6 lista ocho límites y **ninguno** cubre `/auth/me` ni
`/auth/logout`. Añadir uno sería inventar contrato, y en `/auth/me` sería además dañino: es la
llamada que el guard `<Auth>` del frontend hace en **cada** carga de página y en cada cambio de
ruta protegida, así que un límite por IP castigaría a una oficina entera detrás del mismo NAT
antes que a un atacante. Las dos rutas ya están protegidas por lo que importa —exigen un JWT
válido con una sesión viva en base de datos— y el trabajo que hacen es una lectura por id y un
`UPDATE` por id.
