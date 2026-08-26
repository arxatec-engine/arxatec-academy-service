# `DELETE /me` — la baja de cuenta

*"Se borran tu progreso y tus comentarios. No se puede deshacer"* (pantalla 11). Este README
existe para explicar dos cosas: **el orden de la transacción** y **por qué el archivo se borra
fuera de ella**.

## 1. El recorrido

```text
DELETE /api/v1/me      { "password": "…" }  (las cuentas de Google no lo mandan)
  → authenticateTokenJwt      sin sesión → 401 UNAUTHENTICATED
  → deleteAccountController   usuario → parse → service → 204
  → deleteAccountSchema       user_id de la sesión; password opcional
  → deleteAccountService      ¿tiene contraseña? → ¿es la suya? → clave del avatar
                              → TRANSACCIÓN → borrar el archivo
  → 204                       sin cuerpo: no queda nada que describir
```

| Paso | Archivo |
| --- | --- |
| cadena de la ruta | `presentation/delete.routes.ts:9` |
| usuario → validación → service → respuesta | `presentation/delete.controller.ts:9-19` |
| reglas | `presentation/delete.service.ts:33-48` |
| la transacción | `../../../shared/data/user_account.repository.ts:97-105` |

## 2. Borrado de verdad, no un `deleted_at`

La pantalla promete *"No se puede deshacer"*. Un borrado suave debajo de ese texto es **una
mentira con esquema de base de datos**: la fila sigue ahí, el correo sigue ocupado, el comentario
sigue leyéndose y cualquier consulta que olvide el filtro lo resucita. `deleteUserAccount` hace
`DELETE`, y las ocho tablas se comprueban vacías contra PostgreSQL real
(`tests/integration/postgres/account_flow.test.ts`, caso 17) y con `curl` sobre una cuenta que
tenía inscripción, progreso, comentario y reporte.

## 3. El orden de la transacción, y por qué es ése

`../../../shared/data/user_account.repository.ts:98-104`:

1. `lesson_progress` y `enrollments` — `deleteUserProgress` (`modules/progress/shared`);
2. `comments` y `comment_reports` — `deleteUserComments` (`modules/comments/shared`);
3. `auth_sessions`, `auth_tokens` y `oauth_accounts` — `deleteUserAuthArtifacts` (`modules/auth/shared`);
4. la fila de `users`.

**De las hojas a la raíz.** Es el orden que funciona sin depender de las claves foráneas: cada
paso borra filas que ya no tienen quien las referencie. Las columnas tienen `onDelete: Cascade`
—salvo `comments.user_id`, que es `SetNull`— así que el motor haría casi todo solo; **hacerlo
explícito es la promesa**. Con `SetNull`, dejar que el motor decida convertiría *"se borran tus
comentarios"* en *"tus comentarios se quedan sin autor"*, que es otra cosa y la pantalla no la
dice. Por eso el paso 2 borra `comments` a mano.

Dentro de cada paso también hay orden: los reportes **antes** que los comentarios, y el avance
**antes** que las inscripciones. Los dos están fijados en los tests de las fachadas
(`src/modules/comments/shared/test/comments_repository.test.ts`,
`src/modules/progress/shared/test/progress_repository.test.ts`).

**Todo en una sola transacción** (`prisma.$transaction`, `:98`). Media baja —comentarios borrados
y cuenta viva, o al revés— es un estado que nadie sabe leer y que ninguna pantalla puede explicar.

**Las tres fachadas reciben el `tx`**, no el cliente global: si alguna escribiera por su cuenta,
estaría fuera de la transacción y un fallo posterior la dejaría aplicada. Hay un test que lo
comprueba argumento a argumento.

**Este módulo no importa el `data/` privado de nadie.** Lo que necesita de `progress` y de
`comments` se lo pide a su `shared/`, ampliado en esta fase con una función cada uno; `pnpm
boundaries` lo verifica sin baseline.

### Efecto colateral, medido y asumido

Borrar un comentario raíz se lleva sus respuestas, porque `comments.parent_id` es `Cascade`
(`prisma/schema/comments.prisma:17`, decidido en la fase 12). Así que **darse de baja borra
también las respuestas que otros escribieron a tus comentarios**, y los reportes que otros
hicieron sobre ellos. Está comprobado con `curl`: la respuesta del vecino desapareció con el hilo.
La alternativa —reasignar las respuestas a un padre fantasma— deja conversaciones colgando de un
mensaje que ya no existe. Lo que **no** se toca es lo que el vecino escribió por su cuenta: sus
comentarios propios siguen enteros (caso 22 del test de integración).

## 4. Por qué el avatar se borra **fuera** de la transacción y **después**

`presentation/delete.service.ts:44-47`: la clave se lee **antes** (la fila que la guarda está a
punto de desaparecer), la transacción corre, y solo entonces se llama al almacenamiento.

Un `remove` de S3 —o del disco— **no participa de la transacción de PostgreSQL**. Si fuera dentro
y la transacción se revirtiera, tendríamos el archivo borrado y la cuenta viva: un usuario que
sigue existiendo con la foto rota, y nada que lo explique. Fuera y después, lo peor que puede
quedar es **un archivo huérfano** que no aparece en ninguna pantalla y que nadie echa de menos.

Y por eso también el fallo del borrado se traga (`../../../shared/data/avatar_storage.ts:5-15`): a
esas alturas la cuenta ya no existe: devolver `500` diría *"no pudimos darte de baja"* sobre una
baja que ya se hizo, y el usuario lo intentaría otra vez con un token que ya no vale.

## 5. La contraseña: quién la necesita y por qué el `401`

`presentation/delete.service.ts:40-42`: solo se exige si la cuenta **tiene** `password_hash`. Para
una cuenta de Google basta la sesión, porque no hay ninguna contraseña que pedir; se comprueba en
el caso 19 del test de integración, que además verifica que su `oauth_accounts` desaparece.

Los dos casos que fallan responden **`401 INVALID_CREDENTIALS`** con textos distintos: *"Escribe
tu contraseña para eliminar la cuenta"* si no llegó, *"La contraseña actual no es correcta"* si
llegó mal. Es un `401` y no un `422` porque lo que falta es **una credencial**, no un campo del
formulario: la petición está bien formada y lo que no se puede es autorizarla. El código es el
mismo que el de login para que el frontend no tenga que aprender uno nuevo.

## 6. `204` y sin sobre

Es la única respuesta del backend que no usa `buildHttpResponse`
(`presentation/delete.controller.ts:18`). Un `204` **no puede llevar cuerpo** —el estándar lo
prohíbe y Express lo descartaría—, así que el sobre no cabe. Devolver `200` con un mensaje solo
para mantener la forma sería inventar contenido para una respuesta cuyo contenido es
*"ya no hay nada"*. La sesión que hizo la llamada murió con la cuenta: el mismo token responde
`401 SESSION_EXPIRED` (caso 18).

## 7. Los tests

- `test/delete.service.test.ts` — la baja con contraseña correcta, el avatar borrado **después**
  de la transacción, la clave leída **antes**, los dos `401`, la cuenta de Google sin contraseña,
  la cuenta sin foto y el borrado de archivo que falla sin deshacer nada.
- `test/delete.controller.test.ts` — el `204` sin cuerpo, el `user_id` de la sesión (no del
  cuerpo), el `401` que sube del service y el `401` sin Bearer.
- `tests/integration/postgres/account_flow.test.ts` — **las ocho tablas a cero** contra PostgreSQL
  real, el token invalidado y el comentario del vecino intacto.
