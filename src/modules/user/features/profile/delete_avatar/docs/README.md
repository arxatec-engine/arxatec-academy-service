# `DELETE /me/avatar` — el porqué

*"Quitar foto"* (pantalla 11). Deja la cuenta con la inicial, que es lo que pinta el frontend
cuando `avatar_url` es `null`.

## 1. El recorrido

```text
DELETE /api/v1/me/avatar
  → authenticateTokenJwt      sin sesión → 401 UNAUTHENTICATED
  → deleteAvatarController    usuario → parse → service → 200
  → deleteAvatarService       lee la clave → limpia la fila → borra el archivo
  → 200 { user }              con avatar_url: null
```

| Paso | Archivo |
| --- | --- |
| cadena de la ruta | `presentation/delete_avatar.routes.ts:9` |
| usuario → validación → service → respuesta | `presentation/delete_avatar.controller.ts:11-23` |
| reglas | `presentation/delete_avatar.service.ts:8-26` |
| escritura | `../../../shared/data/user_account.repository.ts:67-76` |

## 2. Primero la fila, después el archivo

`presentation/delete_avatar.service.ts:11-23`: se lee `avatar_key`, se ponen las **dos** columnas
a `null` y solo entonces se borra el archivo. Si el borrado del archivo fuera primero y el `UPDATE`
fallara, la fila apuntaría a un archivo que ya no existe y la pantalla enseñaría una imagen rota.
Con este orden, el peor caso es un huérfano invisible.

Es el mismo motivo por el que `removeStoredAvatar` (`../../../shared/data/avatar_storage.ts:5-15`)
se traga el error: cuando se ejecuta, lo que el usuario pidió **ya está hecho**.

## 3. Quitar una foto que no hay responde `200`, no `404`

Un `avatar_key` nulo sale sin llamar al almacenamiento (`avatar_storage.ts:6-8`) y el `UPDATE`
escribe los `null` que ya estaban. La operación es idempotente porque el resultado que el usuario
quiere —*"no tengo foto"*— es el mismo las dos veces; un `404` obligaría a la pantalla a
distinguir dos casos que para ella son uno.

**Las cuentas de Google entran por aquí.** Su `avatar_url` apunta a `googleusercontent.com` y su
`avatar_key` es `null`: quitar la foto borra la URL de la fila —el usuario deja de ver la foto de
Google, que es lo que pidió— y **no se intenta borrar nada** en nuestro almacenamiento, que no es
nuestro. Volver a iniciar sesión con Google la repone (`callback.service.ts:65`), y eso es
correcto: es la foto que la cuenta trae.

## 4. Los tests

`test/delete_avatar.service.test.ts` — las dos columnas a `null`, el borrado **después** del
`UPDATE`, la idempotencia sin clave, el borrado que falla sin romper la petición y el `404` de un
usuario que ya no existe.
