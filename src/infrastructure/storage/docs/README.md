# `src/infrastructure/storage` — el porqué

Tres cosas suben archivos en Academy: la **portada de un curso** (fase 14), los **recursos de una
lección** (fase 15) y la **foto de perfil**. Esta carpeta se escribió en la fase 08 para que las
tres se escriban contra **la misma interfaz** y ninguna tenga que tocarse el día que entre S3.

**La fase 13 fue la primera en usarla de verdad**, con el avatar
(`src/modules/user/features/profile/update_avatar/presentation/update_avatar.service.ts:14-45`), y
el puerto aguantó sin cambios: `validateUpload`, `buildStorageKey`, `save` y `remove`, tal y como
estaban. Lo único que hizo falta añadir fue **fuera** de esta carpeta: una columna `avatar_key` en
`users`, porque `remove` borra por clave y `avatar_url` puede apuntar a un host ajeno (la foto de
una cuenta de Google). El porqué está en `src/modules/user/docs/README.md` §4.

Está en `infrastructure/` y no en `utils/` por `02_reglas_backend.md` §9.7: lee `env`, escribe en
disco y mañana abrirá conexiones. Un util es puro y no tiene configuración.

## 1. El puerto y sus dos adaptadores

```ts
save(input: SaveFileInput): Promise<StoredFile>;
remove(key: string): Promise<void>;
publicUrl(key: string): string;
```

`StoragePort` (`src/infrastructure/storage/storage.types.ts:16-20`). La instancia única que usan
los slices es `storage` (`src/infrastructure/storage/storage.ts:7-13`), elegida por
`env.STORAGE_DRIVER` **en el import**, no en cada llamada.

| Adaptador | Cuándo | Qué hace |
| --- | --- | --- |
| `local` (`local_storage.adapter.ts:25`) | desarrollo (`STORAGE_DRIVER=local`) | escribe bajo `STORAGE_LOCAL_PATH` y se sirve por `/files/:key` |
| `s3` (`s3_storage.adapter.ts:8-12`) | producción | **declarado y sin implementar**: sus tres métodos lanzan |

**Por qué el de S3 lanza en vez de estar "casi hecho".** Un adaptador a medias que nadie ha
ejecutado da la sensación de estar resuelto y no lo está; el día del despliegue se descubre con
el bucket delante. Lanzando, el fallo aparece en el primer arranque con `STORAGE_DRIVER=s3` y con
un mensaje que dice exactamente qué falta (`src/constants/messages/files.ts:5-6`). Además,
`env.ts` exige las cuatro `AWS_*` en cuanto el driver es `s3` (`src/config/env.ts:58-71`), así
que la configuración incompleta no llega ni a arrancar.

**Construir el adaptador no lanza; solo lanzan sus métodos** (`s3_storage.adapter.ts:4-6`). Si
lanzara al construirse, importar `storage` desde cualquier sitio reventaría el proceso entero.

## 2. La validación va antes de escribir nada

`validateUpload` (`src/infrastructure/storage/validate_upload.ts:35`) es pura: recibe uso, mime
declarado, tamaño y los bytes, y devuelve el mime ya validado o lanza. No toca disco. El orden de
las tres comprobaciones importa:

1. **Tamaño** (`:41-43`) → `413 FILE_TOO_LARGE`.
2. **Mime declarado contra la lista blanca de ese uso** (`:24-33`) → `415 INVALID_FILE_TYPE`.
3. **Bytes de cabecera contra el mime declarado** (`:47-49`) → `415 INVALID_FILE_TYPE`.

| Uso | Tipos | Tamaño máximo |
| --- | --- | --- |
| Portada de curso | `image/jpeg`, `image/png`, `image/webp` | 5 MB |
| Recurso de lección | PDF + ofimática (`doc`, `docx`, `xls`, `xlsx`, `ppt`, `pptx`) | 20 MB |
| Foto de perfil | `image/jpeg`, `image/png` | **2 MB** — pantalla 11: *"JPG o PNG, hasta 2 MB"* |

Los tres límites y las tres listas están en `src/constants/files.ts:26-44`; aquí no hay ningún
número.

**El `mime` que manda el cliente no se cree.** `Content-Type` lo escribe quien sube: un `.exe`
renombrado a `.pdf` llega con `application/pdf` si el que sube quiere que llegue así.
`detectFileSignature` (`file_signature.ts:40`) compara los primeros bytes contra las seis firmas
de `FileSignatures` y `FileSignatureByMimeType` (`src/constants/files.ts:70-81`) dice qué firma
exige cada mime.

**Lo que la firma puede y lo que no.** `docx`, `xlsx` y `pptx` son ZIP, y `doc`, `xls` y `ppt`
son contenedores OLE: la firma demuestra la **familia**, no el formato exacto. Un `.xlsx`
renombrado a `.docx` pasa. Eso es aceptable —los dos son ofimática permitida en el mismo uso— y
lo que la comprobación cierra de verdad es el caso que importa: **un ejecutable disfrazado**. Ir
más allá exigiría abrir el ZIP y leer su `[Content_Types].xml`, que es un parser más en el
camino de subida por un riesgo que ya está cubierto.

**El uso decide, no el formato.** `image/webp` es válido para una portada y **no** para un
avatar, porque la pantalla 11 promete "JPG o PNG". Por eso la lista blanca está indexada por uso
y no hay una lista global.

## 3. Claves: cómo se nombra un archivo guardado

`buildStorageKey` (`storage_key.ts:13`) produce `<prefijo del uso>/<uuid>.<extensión>` —
`course_covers/6b1f….png`. Tres decisiones:

- **El nombre original del cliente no se usa nunca.** Es texto que escribe un desconocido: trae
  `../`, unicode raro y longitudes arbitrarias. El nombre bonito del archivo se guarda en la
  columna `title` de `lesson_resources`, que es donde el usuario lo ve.
- **La extensión sale del mime ya validado** (`FileExtensions`, `src/constants/files.ts:46-57`),
  no de la cadena que mandó el cliente.
- **`isSafeStorageKey`** (`storage_key.ts:20`) es una lista blanca por expresión regular, no una
  lista negra de `..`. El adaptador local la aplica **en cada operación**
  (`local_storage.adapter.ts:28-34`), incluidas las claves que vengan de la base de datos: una
  fila con `../../etc/passwd` en `file_url` sería un borrado arbitrario en `remove`, y aquí las
  filas también se tratan como entrada.

## 4. El adaptador local

- `save` (`local_storage.adapter.ts:41-48`) crea el directorio con `recursive: true` y devuelve
  ya la URL pública, para que el llamador no tenga que componerla.
- `remove` (`local_storage.adapter.ts:50-52`) usa `rm(..., { force: true })`: **borrar algo que
  no existe no revienta**. Borrar es idempotente porque las tres funciones que lo llamarán
  (reemplazar una portada, quitar un recurso, borrar la cuenta) pueden ejecutarse dos veces o
  encontrarse el archivo ya borrado a mano en desarrollo.
- `publicUrl` es síncrono y no toca disco: se usa al construir respuestas y al sembrar.

**Quién sirve los archivos.** No este adaptador: `createApp()` monta `express.static` bajo
`/files` (`src/app/create_app.ts:33`, `src/middlewares/local_files.ts:17-20`), y con
`STORAGE_DRIVER=s3` ese middleware es un `next()` vacío porque los sirve el bucket.
Comprobado en la fase 08 sobre el servidor arrancado: `GET /files/course_covers/<clave>.png`
devuelve `200 image/png` con los mismos bytes que hay en disco, y una clave inexistente cae en el
404 con el sobre normal.

## 5. Lo que esta carpeta no hace

- **No corta por tamaño**: eso es de multer, en el borde
  (`src/middlewares/docs/README.md` §8). Cuando `validateUpload` recibe los bytes, el archivo ya
  está entero en memoria; si el único tope estuviera aquí, un archivo de 2 GB se cargaría antes
  de rechazarse.
- **No borra huérfanos.** Si una fila se borra y su archivo no, el archivo se queda. No hay
  recolector y no hace falta todavía; el día que haga falta, el punto de corte es `remove`.
  La fase 13 crea huérfanos a propósito en dos casos —si falla el borrado de la foto anterior al
  reemplazarla, y si falla el del avatar de una cuenta que se acaba de dar de baja—, porque las
  dos alternativas son peores: dejar la fila apuntando a un archivo que ya no está, o devolver un
  error por una operación que ya se hizo (`src/modules/user/shared/docs/README.md` §3).
