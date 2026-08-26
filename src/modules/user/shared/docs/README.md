# `modules/user/shared` — el porqué

Lo que comparten los seis slices del módulo. Tres archivos de datos y dos de dominio.

## 1. Un solo repositorio para `users`

`data/user_account.repository.ts` concentra **todo** el acceso a la tabla desde este módulo. La
alternativa —un `data/` por slice— habría repartido cuatro `select` distintos de la misma tabla
por cuatro carpetas, y el que importa aquí es que **ninguno de ellos deje salir `password_hash`**.

| `select` | Líneas | Para qué |
| --- | --- | --- |
| `USER_PROFILE_SELECT` | `:17-30` | lo que devuelve la API: las doce columnas de `toApiUser`, ni una más |
| `USER_CREDENTIALS_SELECT` | `:32-36` | `id`, `email` y `password_hash`, **solo** para comparar |
| `USER_AVATAR_SELECT` | `:38` | la clave de almacenamiento, para poder borrar el archivo |
| `USER_SUMMARY_SELECT` | `:40` | `created_at`, el *"Miembro desde…"* |

**`password_hash` se lee en un sitio y no sale de él.** `findUserCredentialsById` (`:42-45`)
devuelve un `UserCredentialsRecord` que **no** tiene mapper a la API: la única forma de que llegue
a una respuesta sería escribirlo a mano. `USER_PROFILE_SELECT`, que sí se serializa, no lo pide —y
hay un test que compara la lista de claves entera
(`../test/user_account_repository.test.ts`, *"nunca pide password_hash"*).

`updateUserProfile` (`:53-65`) escribe **cinco columnas** y `email` no está entre ellas. Esa es la
segunda mitad de "el correo no se cambia por aquí": aunque un cuerpo malicioso lo trajera y el
controller lo leyera, el `data` del `update` no lo lleva.

## 2. Las dos transacciones

**`changeUserPassword` (`:78-95`)** guarda el hash nuevo y revoca las demás sesiones **en la
misma transacción**. Si fueran dos escrituras sueltas y la segunda fallara, la contraseña habría
cambiado y las sesiones robadas seguirían vivas — justo el estado que el cambio quiere evitar.
La revocación no se reimplementa: llama a `revokeOtherUserSessions`
(`@/modules/auth/shared/data/sessions.repository.ts:74-84`) pasándole el `tx`.

**`deleteUserAccount` (`:97-105`)** borra en el orden que fija la fase: progreso → comentarios →
sesiones/tokens/OAuth → la fila de `users`. El porqué del orden y del borrado real está en
`../../features/account/delete/docs/README.md`.

**Las tres funciones ajenas reciben el `tx`, no el cliente global.** Un `deleteUserProgress` que
usara `prisma` por su cuenta escribiría **fuera** de la transacción: si el borrado de `users`
fallara después, el progreso ya no estaría y la cuenta sí. Por eso la firma de las tres fachadas
es `(user_id, client = prisma)` y aquí siempre se pasa el segundo argumento; hay un test que lo
comprueba (*"todo va dentro de la transaccion"*).

## 3. `removeStoredAvatar` no puede tumbar una petición

`data/avatar_storage.ts:5-15` traga el error del almacenamiento y lo escribe en el log
(`UserMessages.avatar.remove_failed`). Lo usan los tres sitios que borran un archivo, y en los
tres el archivo es **basura**, no el resultado que el usuario pidió:

- al subir una foto nueva, la vieja ya no la referencia nadie;
- al quitar la foto, la fila ya está limpia;
- al darse de baja, la cuenta ya no existe.

Fallar la petición por no poder borrar basura sería enseñarle un error a alguien cuya operación
**sí** se hizo. Un `avatar_key` a `null` sale por la puerta de arriba sin llamar al puerto (`:6-8`),
que es el caso de las cuentas de Google y el de quien nunca subió foto.

## 4. `userNotFound` está aquí y no en cada service

`domain/user_not_found.ts:6-9` es el `404` de "la fila ya no está". Cuatro services lo lanzan
después de un `find…` que devolvió `null`. Es alcanzable de verdad, aunque parezca imposible con
una sesión válida: dos pestañas abiertas, la baja en una y el resto en la otra. El texto es el que
ya existía (`AuthMessages.user.not_found`), no uno nuevo.
