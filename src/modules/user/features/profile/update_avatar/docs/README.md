# `PUT /me/avatar` — el porqué

*"Cambiar foto — JPG o PNG, hasta 2 MB"* (pantalla 11).

## 1. El recorrido

```text
PUT /api/v1/me/avatar   (multipart/form-data, campo "file")
  → authenticateTokenJwt              sin sesión → 401 UNAUTHENTICATED
  → createFileUpload(avatar)          multer en memoria; > 2 MB → 413 FILE_TOO_LARGE
  → updateAvatarController            usuario → archivo → parse → service → 200
  → validateUpload                    tipo y bytes de cabecera → 415 INVALID_FILE_TYPE
  → storage.save                      escribe avatars/<uuid>.<ext>
  → setUserAvatar                     guarda avatar_url y avatar_key
  → removeStoredAvatar                borra la anterior; si falla, se loguea
  → 200 { user }
```

| Paso | Archivo |
| --- | --- |
| cadena de la ruta | `presentation/update_avatar.routes.ts:11-16` |
| usuario → archivo → validación → service | `presentation/update_avatar.controller.ts:11-29` |
| el archivo, sacado de `req` | `utils/uploaded_file.ts:16-33` |
| reglas | `presentation/update_avatar.service.ts:14-45` |
| escritura de la fila | `../../../shared/data/user_account.repository.ts:63-72` |

## 2. Dos topes de tamaño, y hacen falta los dos

**multer corta en el borde** (`src/middlewares/file_upload.ts:12-19`): el archivo se rechaza
mientras se recibe, sin cargar 2 GB en memoria para después decir que no. **`validateUpload`
vuelve a medir** (`src/infrastructure/storage/validate_upload.ts:41-43`) porque es la regla de
dominio y no depende de qué middleware haya delante.

**El límite es inclusivo: 2 MB exactos pasan.** Busboy dispara su límite cuando el tamaño
**alcanza** `fileSize` (`node_modules/busboy/lib/types/multipart.js:476`), no cuando lo supera, así
que con `fileSize = 2 MB` un archivo de 2 MB clavados respondía `413` y la pantalla prometía
*"hasta 2 MB"*. Por eso multer recibe `FileMaxSizeBytes[usage] + FileUploadSizeSlack`
(`src/constants/files.ts:87`) y el corte exacto lo pone la regla de dominio. Los dos bordes están
fijados: `src/middlewares/test/file_upload.test.ts`, `test/update_avatar.service.test.ts` y el
caso 11-12 de `tests/integration/postgres/account_flow.test.ts`.

## 3. El `mime` del cliente no se cree

`Content-Type` lo escribe quien sube. `validateUpload` compara los **primeros bytes** contra la
firma que exige el mime declarado (`src/infrastructure/storage/file_signature.ts:40-54`), así que
un GIF renombrado a `.png` y anunciado como `image/png` responde `415` igual que uno que se
declara `image/gif`: los dos casos están en el test de integración (caso 13). `image/webp` vale
para una portada de curso y **no** para un avatar, porque la lista blanca es por uso
(`src/constants/files.ts:43`) y la pantalla promete JPG o PNG.

## 4. Se guarda primero y se borra después

El orden de `presentation/update_avatar.service.ts:30-42` es: guardar el archivo nuevo → escribir
la fila → borrar el anterior. Al revés, un fallo al guardar dejaría al usuario **sin ninguna
foto** después de una petición que quería cambiarla. Así, el peor caso es un archivo huérfano en
el almacenamiento, que no se ve desde ninguna pantalla.

Por eso el borrado del anterior **no puede fallar la petición** (`../../../shared/data/avatar_storage.ts:5-15`):
cuando llega ese punto, la foto nueva ya está puesta y la vieja ya no la referencia nadie.

La clave anterior se lee **antes** de escribir la nueva (`:24`), porque escribir la pisa.

## 5. Sin archivo, `422` y no `400`

`requireUploadedFile` (`utils/uploaded_file.ts:16-26`) devuelve `422` con
`fields.file = user.errors.avatar_required`, la forma que el formulario ya sabe pintar junto al
campo. Vive en `utils/` del slice porque toca `req` —es la única pieza fuera de `presentation/`
que lo hace— y así el service recibe bytes, no una petición HTTP.

Un campo con **otro nombre** (`avatar` en vez de `file`) lo corta multer antes, con `400`
(`LIMIT_UNEXPECTED_FILE` → `src/middlewares/error_handler.ts:91-97`). Es un cliente mal escrito,
no un usuario equivocado.

## 6. Los tests

- `test/update_avatar.service.test.ts` — la clave con el prefijo `avatars/`, las dos columnas que
  se escriben, el orden del borrado, el `415` del GIF y del PNG disfrazado, los dos bordes de
  tamaño, el borrado que falla sin romper nada y el `404`.
- `test/update_avatar.controller.test.ts` — el `200`, los bytes exactos que recibe el service, los
  2 MB que pasan, el `413` con un byte más, el `422` sin archivo y el `401` sin Bearer.
