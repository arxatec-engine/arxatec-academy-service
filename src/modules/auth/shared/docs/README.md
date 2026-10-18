# `src/modules/auth/shared` — el porqué

**La única superficie del módulo de auth que otro módulo puede importar.** Lo fija
`02_reglas_backend.md` §9.6 y lo vigila `no-cross-module-private` en
`.dependency-cruiser.cjs:23-29`: el `data/` privado de un slice no se importa nunca desde fuera;
`modules/auth/shared/` sí.

Aquí vive lo que usan **varias** actions del módulo (§9.2). Lo que use una sola se queda en el
`domain/` de esa action, y lo que sea genuinamente transversal a todo el backend sube a
`src/utils` o `src/constants`. Esta carpeta no es un cajón: si algo acaba usándose desde un solo
slice, baja.

```text
data/     sessions.repository.ts   users.repository.ts   auth_artifacts.repository.ts
domain/   auth_user.types.ts  session.types.ts  user_mapper.ts  normalize_email.ts
          account_fields.ts   account_fields.schema.ts
policy/   session_policy.ts        <- pura, con test
test/     session_policy.test.ts   user_mapper.test.ts   sessions_repository.test.ts
```

**Tres piezas entraron aquí con la fase 13**, y las tres por la misma razón: pasaron de usarlas
un slice a usarlas dos módulos (§9.3). Están documentadas en §7.

## 1. `domain/user_mapper.ts` — la frontera por la que no sale el hash

`toApiUser` (`src/modules/auth/shared/domain/user_mapper.ts:3`) construye el modelo del contrato
§2 **campo a campo**. No es un `delete user.password_hash`, ni un `...spread` con omisiones: es una
lista explícita, y ésa es justamente la propiedad que interesa. Un `spread` deja pasar cualquier
columna nueva que se añada a `users` mañana; una lista explícita obliga a decidir.

Es la **segunda** de dos barreras. La primera es el `select` explícito de los repositorios
(`02_reglas_backend.md` §7). Se sostienen las dos porque protegen de fallos distintos: el `select`
evita traer el hash de la base de datos, el mapper evita serializarlo si alguien amplía el `select`.
`src/modules/auth/shared/test/user_mapper.test.ts` fija las dos: la lista exacta de claves y que
`argon2id` no aparece ni en el JSON.

Las fechas salen en **ISO 8601** (`:13,15`), no como `Date`. `JSON.stringify` haría lo mismo por su
cuenta, pero entonces el tipo `ApiUser` mentiría sobre lo que el frontend recibe, y el frontend
tipa su adaptador contra ese modelo.

## 2. `domain/normalize_email.ts` — una línea que sostiene el índice único

`normalizeEmail` (`src/modules/auth/shared/domain/normalize_email.ts:1`) hace `trim().toLowerCase()`.
Parece trivial y no lo es: la columna es `VARCHAR(254) @unique` (`prisma/schema/users.prisma:4`),
**no `citext`**, así que para PostgreSQL `Maria@x.pe` y `maria@x.pe` son dos correos distintos y el
índice único deja crear las dos cuentas. La normalización es de aplicación, y por eso vive dentro
de `users.repository` en los tres sitios donde un correo toca la base de datos
(`src/modules/auth/shared/data/users.repository.ts:45,56`): ponerla en cada slice sería confiar en
que ninguno se olvide.

## 3. `policy/session_policy.ts` — la única función de este módulo sin I/O

Pura a propósito, y con test propio (`src/modules/auth/shared/test/session_policy.test.ts`), porque
concentra los números que el producto promete:

| Función | Qué decide | Constante |
| --- | --- | --- |
| `resolveSessionTtlSeconds` (`:27`) | 30 días con `remember_me`, 12 h sin él | `AuthTokenTtlSeconds` (`src/constants/auth.ts:1-8`) |
| `computeSessionExpiresAt` (`:30`) | el `expires_at` de la fila (caducidad por inactividad) | ídem |
| `computeSessionAbsoluteExpiresAt` (`:36`) | el **tope absoluto** de la sesión, que es el `exp` del JWT | `AuthTokenTtlSeconds.session_absolute_max` (180 d) |
| `isSessionRevoked` / `isSessionExpired` / `isSessionActive` (`:39,42,45`) | si la sesión sirve | — |
| `resolveSessionRenewal` (`:48`) | **si toca escribir** y con qué fechas, sin pasarse del tope absoluto | `AuthPolicy.session_sliding_renewal_seconds` (`src/constants/auth.ts:11`) |

**Dos caducidades y una sola autoridad.** La fila de `auth_sessions` manda: su `expires_at` se
empuja con cada uso (contrato §3) y es lo que decide si la sesión sirve. El `exp` del JWT es otra
cosa —el tope absoluto de 180 días desde `created_at`— porque un JWT firmado no se puede mover y
firmarlo con la fecha deslizante expulsaba al usuario activo el día 31 (el porqué completo está en
`src/infrastructure/docs/README.md` §2). `resolveSessionRenewal` nunca devuelve un `expires_at`
posterior a ese tope, así que la fila jamás promete más vida de la que el token tiene firmada.

**Por qué la decisión de renovar está aquí y no en el middleware.** El middleware hace I/O; esta
función no. Separadas, el freno de los 5 minutos se puede probar con fechas fijas y sin base de
datos, que es la diferencia entre un test de 1 ms y uno que necesita Postgres. El middleware
(`src/middlewares/authenticate_token_jwt.ts:42-53`) solo obedece lo que decide `should_renew`.

`resolveSessionRenewal` devuelve **siempre** las tres cosas, renueve o no. El llamador lee
`should_renew` y usa las fechas ya calculadas; no tiene que volver a calcularlas ni saber la
política.

Detalles que el test fija y que no son obvios:

- el corte es `>=` (`:56`): a los 300 s exactos **sí** se escribe;
- el `expires_at` que devuelve es el **menor** entre el deslizante y el tope absoluto (`:60-65`);
- un `last_used_at` en el futuro (reloj desajustado entre instancias) **no** renueva, en vez de
  producir una fecha absurda;
- `isSessionExpired` vence en el instante exacto de `expires_at`, no un milisegundo después;
- ninguna función muta la fecha que recibe.

Los 12 h de sesión corta son el único número que no sale del brief: se decidió en D-011 y se
cambia aquí, en una constante y un test.

## 4. `data/` — `select` explícito, siempre

### `users.repository.ts`

`AUTH_USER_SELECT` (`:9-22`) es el modelo del contrato §2 y **no incluye `password_hash`**.
`AUTH_USER_WITH_PASSWORD_SELECT` (`:24-27`) lo añade, y lo usa **solo** `findUserByEmail`
(`:43`), que es la consulta del login: comparar la contraseña exige tener el hash. Que el hash
tenga su propio `select` con nombre es lo que hace visible en el diff quién lo pide.

`findUserById` (`:49`) **no** trae el hash: es la consulta de `GET /me`, que no lo necesita.
La regla operativa para los slices: si tu endpoint no compara contraseñas, usa `findUserById`.

`createUser` (`:52`) devuelve `AUTH_USER_SELECT`, así que el objeto que sale del registro ya no
puede llevar el hash aunque acabe de escribirlo.

### `sessions.repository.ts`

`SESSION_SELECT` (`:5-13`) incluye `created_at` porque de ahí sale el tope absoluto de la sesión
(§3). `SESSION_WITH_USER_SELECT` (`:15-20`) trae la sesión **y** los cuatro campos del usuario que
el middleware necesita para `req.user`. Es una sola consulta en lugar de dos: cada petición
autenticada paga este viaje (D-004), y duplicarlo doblaría el precio de la decisión.

| Función | Uso |
| --- | --- |
| `createSession` (`:43`) | registro, login, canje de Google |
| `findSessionById` (`:55`) | el middleware, en cada petición autenticada |
| `revokeSession` (`:58`) | `POST /auth/logout` |
| `revokeAllUserSessions` (`:67`) | reset de contraseña consumido (`01_reglas_globales.md` §8.4) |
| `touchSession` (`:79`) | caducidad deslizante |

**`updateMany` en vez de `update`** en las tres escrituras (`:59,71,80`). `update` lanza
`P2025` cuando no encuentra la fila; `updateMany` devuelve `count: 0`. Eso es lo que hace
**idempotente** el logout que el contrato §4.3 exige: cerrar una sesión ya cerrada responde `200`,
no un error. El filtro `revoked_at: null` (`:60,72`) además impide que una revocación posterior
pise la fecha de la primera.

`touchSession` también filtra `revoked_at: null` (`:81`): sin ese filtro, una carrera entre el
logout y la renovación deslizante podría reactivar el `expires_at` de una sesión recién cerrada.

`truncate` (`:34`) recorta `user_agent` e `ip_address` al ancho real de la columna
(`AuthPolicy.user_agent_max_length`, `src/constants/auth.ts:20-21`). Son datos que escribe el
cliente: un `User-Agent` de 10 KB no puede convertir un login en un `500` de PostgreSQL.

## 5. `domain/*.types.ts` — por qué hay tipos escritos a mano

`AuthUserRecord`, `SessionRecord` y compañía (`domain/auth_user.types.ts`, `domain/session.types.ts`)
se declaran a mano en vez de derivarlos de `Prisma.usersGetPayload<…>`. Dos razones: el tipo
derivado obligaría a importar `@/generated/client` desde el dominio —lo que arrastra el cliente
entero a cualquier test que roce el módulo— y, sobre todo, un tipo escrito a mano **no se amplía
solo** cuando alguien añade una columna a `users`. Aquí eso es la diferencia entre revisar y
enterarse.

`ApiSession` (`domain/session.types.ts:24-28`) es la forma exacta del contrato §3
(`{ token, expires_at, user }`) y la comparten los cuatro endpoints que devuelven sesión: registro,
login, canje de Google y —parcialmente— `/me`.

## 7. Lo que la fase 13 movió o añadió aquí

| Pieza | De dónde viene | Quién la usa ahora |
| --- | --- | --- |
| `domain/account_fields.schema.ts:12-44` | `features/registration/register/domain/register.schema.ts` | el registro; `PATCH /me/profile` reutiliza solo `full_name` |
| `domain/account_fields.ts:23-31` | `features/registration/register/utils/resolve_account_fields.ts` | el registro |
| `data/sessions.repository.ts:74-84` | nueva | `PATCH /me/password` |
| `data/auth_artifacts.repository.ts:4-11` | nueva | `DELETE /me` |

**`accountProfileShape`** contiene las reglas de los datos de registro. Se exporta como **shape**
para reutilizar sus campos individualmente: el perfil usa solo `full_name` y añade el
`user_id` de la sesión (`src/modules/user/features/profile/update/domain/update.schema.ts:6-9`).
**`requireCityOther`** se aplica al registro cuando el cliente proporciona explícitamente ciudad
`OTHER`; el formulario de perfil ya no solicita ciudad ni organización.

**`revokeOtherUserSessions`** es la hermana de `revokeAllUserSessions` con un `id: { not: … }`, y
existe porque cambiar la contraseña estando dentro **no** debe cerrar la sesión que la está
cambiando (el reset por enlace sí las cierra todas). Acepta un `Prisma.TransactionClient` opcional
para poder correr dentro de la transacción de quien la llama; por defecto usa el cliente global.

**`deleteUserAuthArtifacts`** borra `auth_sessions`, `auth_tokens` y `oauth_accounts` de un
usuario. Vive aquí y no en `sessions.repository.ts` porque toca tres tablas del módulo y ninguna de
ellas es "la sesión actual": es la parte de auth de la baja de cuenta. La invoca
`modules/user`, siempre con el `tx` de su transacción.
