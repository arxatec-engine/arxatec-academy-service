# `auth/google_login/callback` — el porqué

**Endpoint 10 del contrato: `GET /api/v1/auth/google/callback` → `302` a
`${FRONTEND_URL}/oauth/callback?code=…&redirect_to=…`.** Es donde vuelve el navegador después de
que la persona acepte en Google, y **no devuelve JSON en el camino feliz**: devuelve una
redirección al frontend con un código opaco de un solo uso (contrato §4.9-11 y D-005).

```text
domain/        callback.schema.ts  callback.payload.ts  callback.types.ts  google_profile.schema.ts
data/          callback.repository.ts
presentation/  callback.service.ts  callback.controller.ts  callback.routes.ts
utils/         oauth_callback_link.ts
test/          callback.service.test.ts  callback.controller.test.ts
```

## 1. El flujo, de punta a punta

| Paso | Dónde | Qué pasa |
| --- | --- | --- |
| Entrada | `presentation/callback.routes.ts:8` | `GET /google/callback`, sin middlewares |
| Validación | `presentation/callback.controller.ts:13` | `googleCallbackSchema.parse(req.query)` — exige `code` y `state` |
| Cookie | `presentation/callback.controller.ts:14` | `takeOauthStateNonce` lee **y borra** la cookie del nonce |
| Estado | `presentation/callback.controller.ts:15` | `verifyOauthState` comprueba firma, edad y nonce, y devuelve el `redirect_to` firmado en el paso 9 |
| Google | `presentation/callback.controller.ts:16` | Passport canjea el `code` por el perfil; `toGoogleProfile` lo normaliza |
| Reglas | `presentation/callback.service.ts:94-108` | resuelve el usuario (entra, enlaza o crea) y emite el código de canje |
| Persistencia | `data/callback.repository.ts:30,43,55,61,70` | `oauth_accounts`, `users` y `auth_tokens`, todo con `select` explícito |
| Salida | `presentation/callback.controller.ts:19` | `302` a la URL que construye `utils/oauth_callback_link.ts:6` |

Sin `try/catch`: el controller es `async` y Express 5 reenvía el rechazo al manejador global.

## 2. El orden de las cinco líneas del controller no es intercambiable

```text
1. parse(query)          ¿vienen code y state?
2. takeOauthStateNonce   lee y BORRA la cookie del inicio (pase lo que pase después)
3. verifyOauthState      ¿el state es nuestro, reciente, de ESTE navegador y con destino seguro?
4. resolveGoogleProfile ← la única llamada de red, y la única que gasta el code
5. completeGoogleCallback  ← la única que escribe en la base
```

**La cookie se retira antes de verificar nada**, no después de que el flujo salga bien: así el
state es de un solo uso incluso cuando la verificación falla, y un state que se reintente ya no
tiene cookie que lo respalde.

**El state se verifica antes de hablar con Google.** Si fuera al revés, cualquiera podría hacer
que este endpoint saliera a `googleapis.com` en cada petición: trabajo de red gratis para el
atacante y una factura de rate limit contra nuestro `client_id`. Con el orden actual, un state
inventado muere en memoria en microsegundos. Fijado en los casos de state manipulado, state de
otro navegador y callback sin cookie de `test/callback.controller.test.ts`, que además comprueban
que `resolveGoogleProfile` **no llegó a llamarse**.

**Y ambas cosas van antes de tocar la base de datos.** El primer `SELECT` solo ocurre cuando ya
sabemos que la vuelta es legítima y que Google confirmó la identidad.

## 3. El `redirect_to` sale del `state`, nunca de la query

`presentation/callback.controller.ts:15` toma el destino de lo que devuelve `verifyOauthState`.
La query de esta petición la controla **quien construya el enlace**, no nosotros: un
`?redirect_to=https://malo.pe` colado aquí no se mira siquiera
(el caso «recupera el destino de retorno del state, no de la query» de
`test/callback.controller.test.ts`).

Aun así, `utils/oauth_callback_link.ts:11` vuelve a pasarlo por `isSafeRedirect` antes de
ponerlo en la URL del frontend. Es la misma defensa en profundidad del slice `start`: el día que
el destino llegue por otra vía, la URL que sale de aquí sigue sin poder apuntar a otro dominio.

El enlace se construye con `new URL(...)` y `searchParams.set` (`:7-12`), no concatenando: el
código de canje es base64url y el destino puede llevar `?` o `&`, y una concatenación a mano
inyectaría parámetros extra en la URL del frontend.

## 4. El perfil de Google se normaliza en `domain/`, no en el service

`toGoogleProfile` (`domain/google_profile.schema.ts:37-65`) recibe el objeto **crudo** que
devuelve Passport —tipado como `object`, que es todo lo que se puede prometer de un JSON de
tercero— y devuelve `GoogleProfilePayload` (`domain/callback.types.ts:1-7`), con exactamente los
cinco campos que este slice usa.

Está en `domain/` porque es validación de entrada, igual que un schema de body: lo que cambia es
que la entrada no viene del cliente sino de Google. Ponerlo en el service obligaría al service a
conocer la forma del perfil de Passport, que es un detalle del proveedor.

Tres decisiones dentro:

- **Se coge el primer correo de la lista** (`:46`). Passport en formato OpenID —el que usa la
  estrategia por defecto (`node_modules/passport-google-oauth20/lib/strategy.js:54-61`)— devuelve
  como mucho uno, el del `id_token`; el array es la forma genérica de `passport`, no una lista
  real de alternativas.
- **Sin correo no hay cuenta** (`:48-54`): `400` con `AuthMessages.google.profile_without_email`.
  Sin correo no se puede enlazar ni crear nada, porque el correo es la clave única de `users`.
- **`full_name` cae al nombre de la parte local del correo** si Google no manda `displayName`
  (`:30-35`), y se trunca a `AuthPolicy.full_name_max_length`: la columna es `VARCHAR(120)` y un
  nombre más largo sería un `500` en vez de un registro.

`isVerified` (`:27-28`) acepta el booleano y la cadena `'true'` porque el campo `verified` de
`passport` está tipado como `string | boolean` según el formato de perfil.

## 5. La regla de enlace de cuentas

`presentation/callback.service.ts:78-92`, en tres ramas y en este orden:

| Caso | Qué se hace |
| --- | --- |
| Ya existe la fila en `oauth_accounts` | se reutiliza su `user_id`; ni un `SELECT` más sobre `users` |
| No existe, pero el correo ya tiene cuenta | **se enlaza**: alta en `oauth_accounts` y `email_verified_at` si estaba a `null` |
| No existe nada | se crea la cuenta con `auth_provider: GOOGLE` y su fila en `oauth_accounts` |

La segunda rama es la que pide el contrato §4 ("**se enlaza la cuenta** … No se crea una
segunda"). La alternativa —crear otro usuario— ni siquiera es posible: `users.email` es `@unique`
(`prisma/schema/users.prisma:4`), así que el intento moriría en un `500` de constraint. Y la
consulta se hace por el correo **normalizado** (`data/callback.repository.ts:57`), porque la
columna es `VARCHAR` y no `citext`: sin `normalizeEmail`, `Maria@X.pe` de Google no encontraría
a `maria@x.pe` y el enlace se convertiría en ese `500`.

La primera rama es la que hace el flujo **idempotente**: entrar cien veces con la misma cuenta de
Google escribe cero filas en `users` y cero en `oauth_accounts`
(`test/callback.service.test.ts:91-104`).

### 5.1. El enlace exige que Google haya verificado el correo — y esto es una desviación

`presentation/callback.service.ts:41-43` **rechaza el enlace** (`400 TOKEN_INVALID`) cuando
`profile.email_verified` es `false` y ya existe una cuenta con ese correo.

El contrato dice "se enlaza y se marca verificado", sin condición. La condición se añade aquí
porque **enlazar sin ella es un secuestro de cuenta**: quien consiga un proveedor que afirme
`email@ajeno.pe` sin haberlo comprobado entra en la cuenta de otro con contraseña, sin saber la
contraseña. Es el fallo clásico de "Sign in with X" y por eso todas las guías de OIDC exigen
`email_verified` antes de unir identidades.

En la práctica no cambia nada para nadie: el endpoint de userinfo que usa la estrategia devuelve
`email_verified: true` para las cuentas normales de Google
(`node_modules/passport-google-oauth20/lib/profile/openid.js:33`). Lo que cambia es el caso raro,
y es justo el que hay que cerrar.

**Si el equipo prefiere el contrato al pie de la letra, es borrar esas tres líneas y su test**
(`test/callback.service.test.ts:181-193`). Está anotado en el informe del slice para que sea una
decisión revisable.

Para la cuenta **nueva** no hay condición: un correo sin verificar crea el usuario con
`email_verified_at: null` (`:66`) y el usuario verifica por el flujo normal. Ahí no hay nada que
secuestrar.

### 5.2. `city: OTHER` para las cuentas de Google

`presentation/callback.service.ts:23,63`. El registro por correo pide la ciudad y el contrato
§4.1 exige `city_other` cuando la ciudad es `OTHER`; Google no da ninguna de las dos cosas, y la
columna `users.city` es **obligatoria**.

Las opciones eran inventar `LIMA` (un dato falso que acabaría en una estadística) o usar `OTHER`
con `city_other: null` (un dato ausente que se ve como ausente). Se eligió lo segundo. **La
consecuencia a conocer:** una cuenta de Google queda con una combinación que el schema de
registro no aceptaría. El día que exista "completa tu perfil", esta es la fila que hay que pedir.

### 5.3. No hay transacción, y se aguanta

`createUser` + `createOauthAccount` (`:57-73`) son dos escrituras sueltas. Si la segunda falla,
queda un usuario sin fila de `oauth_accounts`; el siguiente intento de esa misma persona cae en
la rama de enlace (`:85-88`) y **se arregla solo**. Envolverlo en una transacción interactiva
para cubrir una ventana que se autocorrige en el siguiente clic es coste sin beneficio.

## 6. El código de canje: opaco, hasheado y de 60 segundos

`presentation/callback.service.ts:100-106`. Se genera con `createOneTimeToken`
(`src/infrastructure/tokens/one_time_token.ts:14`), el mismo generador que la verificación de
correo y el reset: 32 bytes de `randomBytes` en base64url.

- **A la base va el hash, nunca el código** (`data/callback.repository.ts:70-81`). SHA-256 en
  hexadecimal, 64 caracteres, que es el ancho exacto de `auth_tokens.token_hash`. Si se filtra un
  volcado de la base, los códigos que hubiera dentro no sirven para abrir sesión
  (`01_reglas_globales.md` §8.3). Fijado en `test/callback.service.test.ts:200-208`, que además
  busca el código en claro dentro de la fila que se guarda.
- **60 s** (`AuthTokenTtlSeconds.oauth_exchange_code`, `src/constants/auth.ts:6`). Es el tiempo
  que tarda la SPA en montar `/oauth/callback` y llamar a `exchange`, no el tiempo de un humano:
  el usuario ya hizo todo lo que tenía que hacer.
- **El tipo `OAUTH_EXCHANGE`** (`data/callback.repository.ts:76`) separa estos códigos de los de
  verificación y reset en la misma tabla. Sin él, un código de canje valdría como token de
  verificación de correo, que es exactamente la confusión de tipos que la columna previene.

## 7. Errores: lo que ve el usuario es una página, no un JSON bonito

Este endpoint lo abre **el navegador**, no `fetch`. Cuando algo falla —state manipulado, Google
devolviendo `error=access_denied`, un perfil sin correo— el manejador global responde el sobre
JSON de siempre y el usuario ve JSON crudo en la pestaña.

Es feo y es **deliberado**: la alternativa era redirigir al frontend con un parámetro de error, y
ese parámetro **no está en el contrato**. Inventarlo aquí obligaría al frontend a adivinarlo.
Queda anotado como la primera fila que le falta al contrato §4.10 si el equipo quiere pulir esa
pantalla.

Los códigos que salen hoy:

| Situación | HTTP | `meta.code` |
| --- | --- | --- |
| Falta `code` o `state` (el usuario canceló en Google) | `422` | `VALIDATION_ERROR` |
| State ajeno, manipulado o de hace más de 10 min | `400` | `TOKEN_INVALID` |
| Google no comparte correo | `400` | `TOKEN_INVALID` |
| Correo sin verificar sobre una cuenta que ya existe | `400` | `TOKEN_INVALID` |
| Sin credenciales de Google en el entorno | `500` | `INTERNAL_ERROR` |

**`TOKEN_INVALID` está algo forzado** en las tres filas del medio: el contrato §5 lo describe
para el token de verificación o reset, y el frontend pinta con él la pantalla de "enlace
caducado". Es el menos malo de los doce códigos existentes —`INTERNAL_ERROR` culparía al servidor
de algo que no es suyo— y añadir uno nuevo es cambiar el contrato y los dos lados a la vez.

## 8. `data/` — cinco funciones, cinco `select` explícitos

`OAUTH_ACCOUNT_SELECT` pide `id` y `user_id`; `LINKABLE_USER_SELECT` pide `id` y
`email_verified_at` (`data/callback.repository.ts:9-17`). **Nada más.** El slice no necesita el
resto del usuario, y `password_hash` no puede colarse en una respuesta si nunca sale de la base
(`02_reglas_backend.md` §7).

`findOauthAccountByProviderAccountId` usa el índice único compuesto
`@@unique([provider, provider_account_id])` (`:33-41`), que es lo que hace que la búsqueda del
"¿ya entró antes?" sea una lectura por índice y no un escaneo.

`markEmailVerified` (`:61-68`) es un `updateMany` con `email_verified_at: null` en el `where`, no
un `update`: así **no pisa una fecha existente** aunque se llame de más, y devuelve el número de
filas tocadas por si algún día interesa distinguir.

El alta del usuario **no** la hace este repositorio: la hace `createUser` del repositorio
compartido (`src/modules/auth/shared/data/users.repository.ts:52`). Es la misma consulta que usa
el registro por correo, y tener dos altas de `users` con dos `select` distintos es exactamente
como se duplican los invariantes.

## 9. Los tests

`test/callback.service.test.ts` (10 casos) mockea por path exacto el repositorio del slice y
`createUser` del compartido (`:19-27`), y **usa el generador de códigos de verdad**: es lo que
permite afirmar que lo guardado es `hashOneTimeToken(código devuelto)` en vez de comprobar que se
llamó a un doble. Cubre las tres ramas de resolución, el rechazo del enlace sin verificar, que
ese rechazo no escribe nada, los 60 s y que dos vueltas dan códigos distintos.

`test/callback.controller.test.ts` (7 casos) monta Express con el manejador global real, mockea
`@/config/passport` y el service (`:22-27`), y **usa `signOauthState` de verdad** (`:20`): el
state del test se firma con el mismo código que lo firmará en producción, así que la vuelta
completa —firmar, redirigir, volver, verificar— queda cubierta sin salir a la red.

Comprueba el destino del `302` campo a campo (origen, path, `code`, `redirect_to`), que **en la
URL no viaja nada más** que esos dos parámetros (`:91-100`) y que el perfil llega al service ya
normalizado, con el correo en minúsculas y sin espacios (`:102-115`).
