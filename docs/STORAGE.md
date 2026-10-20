# Archivos de Academy

Portadas, recursos de lección y avatares usan el mismo
[puerto](../src/infrastructure/storage/storage.types.ts): `save`, `remove`, `publicUrl` y `readUrl`.
Están implementados [local](../src/infrastructure/storage/local_storage.adapter.ts) y
[S3 con CloudFront firmado](../src/infrastructure/storage/s3_storage.adapter.ts).
La selección se realiza al iniciar el proceso; los services conservan sus rutas multipart.

## Contratos de subida

| Uso                | Ruta bajo `/api/v1`                        | Formato permitido                 | Tamaño máximo |
| ------------------ | ------------------------------------------ | --------------------------------- | ------------- |
| Avatar propio      | `PUT /me/avatar`                           | JPEG, PNG                         | 2 MiB         |
| Portada de curso   | `PUT /admin/courses/:id/cover`             | JPEG, PNG, WebP                   | 5 MiB         |
| Recurso de lección | `POST /admin/lessons/:lesson_id/resources` | PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX | 20 MiB        |

Enviar multipart con un único campo `file`; el recurso exige también `title`.
La autenticación/autorización precede a Multer, que recibe los bytes en memoria.
`validateUpload` comprueba tamaño, MIME permitido y firma binaria. Las firmas ZIP/OLE
identifican contenedores Office; no inspeccionan su contenido completo.

La portada debe ser horizontal, de al menos 1200 × 750 píxeles: `422 IMAGE_TOO_SMALL`.
Un formato inválido devuelve `415 INVALID_FILE_TYPE`; exceso de tamaño,
`413 FILE_TOO_LARGE`; multipart inválido, `400 VALIDATION_ERROR`.
Ver [políticas de archivos](../src/constants/files.ts) y [cursos](../src/constants/courses.ts).

## Claves y URLs

El servidor genera `public/avatars/`, `public/course_covers/` y `private/lesson_resources/`.
Las claves legacy de dos segmentos siguen siendo válidas para leer o borrar, y se firman al leer
si no tienen el root `public/`; eso no modifica los permisos del comportamiento CDN para su ruta.
Los adaptadores validan claves antes de escribir o borrar; S3 también las valida antes de
construir o firmar URLs. No se aceptan rutas absolutas, traversal, query strings ni URLs como clave.

La base conserva URL canónica y clave interna por separado: `avatar_url/avatar_key`,
`cover_image_url/cover_image_key` y `file_url/file_key`. `save().url` y `publicUrl(key)` son
estables y no tienen firma temporal. La semilla usa `publicUrl` para sus metadatos de ejemplo;
no sube los bytes ni prueba que existan.

Al construir respuestas, los services usan [resolveStoredFileUrl](../src/infrastructure/storage/file_url.ts)
con la clave consultada por el repositorio. En S3, `readUrl(key)` devuelve `/public/` sin firma
y firma `/private/` al leer; en local entrega la URL local. Las claves internas no se añaden al DTO. Avatares externos de
Google y filas legacy con clave nula conservan su URL original: no se firma una URL arbitraria.
Las fotos de docentes introducidas como URL externa tampoco pasan por este almacenamiento.

La lectura usa la base actual y la clave persistida. Cambiar de dominio no exige reescribir las
URLs de filas con clave, pero sí disponer de los mismos objetos bajo las mismas claves en el
origen nuevo. Las filas sin clave requieren una migración controlada.

## S3 y CloudFront privado

Con `STORAGE_DRIVER=s3`, la API sube mediante `PutObject` y elimina mediante `DeleteObject`.
Conserva bytes, `Content-Type` y longitud; no envía ACL pública. Los fallos de AWS o de firma
producen `503 STORAGE_UNAVAILABLE` sin exponer detalles del proveedor. No hay fallback a S3
público ni a URLs CDN sin firma. Los reintentos y timeouts están acotados.

Configuración mínima (los valores son ejemplos, no credenciales):

```dotenv
STORAGE_DRIVER=s3
AWS_REGION=us-east-1
S3_ACADEMY_PRODUCT_BUCKET=academy-files
CDN_ACADEMY_PRODUCT_BASE_URL=https://cdn.academy.example.com
CLOUDFRONT_ACADEMY_PRODUCT_KEY_PAIR_ID=ID_DE_LA_CLAVE_PUBLICA
CLOUDFRONT_ACADEMY_PRODUCT_PRIVATE_KEY_PATH=/run/secrets/cloudfront-private.pem
CLOUDFRONT_SIGNED_URL_TTL_SECONDS=300
```

Para AWS, usar el rol IAM/default credential chain o completar conjuntamente
`AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY`; `AWS_SESSION_TOKEN` admite credenciales temporales.
La identidad del backend necesita `s3:PutObject` y `s3:DeleteObject` en sus prefijos de archivos.
Permisos adicionales de KMS dependen del cifrado del bucket.

Los nombres de producto tienen prioridad con S3; se conservan los alias genéricos de [ENV](ENV.md).
Para firmar, configurar exactamente una fuente: `CLOUDFRONT_ACADEMY_PRODUCT_PRIVATE_KEY` con PEM inline
(admite saltos escapados) o `CLOUDFRONT_ACADEMY_PRODUCT_PRIVATE_KEY_PATH` con un archivo privado legible por el
proceso. Nunca colocar ese PEM en el frontend, repositorio o carpeta pública de archivos.
La clave RSA debe ser de 2048 bits. La configuración inválida falla al inicio sin imprimirla.
La firma usa SHA256 y caduca en 300 segundos por defecto; el TTL admite enteros de 1 a 86400.
El ID corresponde a la clave pública de CloudFront, no al grupo ni a la distribución.

La distribución debe tener **Restrict viewer access** activado y un grupo confiable con esa
clave pública en el comportamiento `/private/*`. `/public/*` debe permitir lectura sin firma. El bucket debe permanecer
privado, con Block Public Access y acceso de origen CloudFront mediante OAC/política limitada
a la distribución. OAC protege el origen; la firma controla el acceso del navegador.
Configurar HTTPS y, si el frontend descarga con fetch, CORS para sus orígenes y GET/HEAD/OPTIONS.
Fuentes AWS: [URLs firmadas](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html),
[claves confiables](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-trusted-signers.html)
y [OAC para S3](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html).

## Autorización, caducidad y caché

Una lección bloqueada no consulta ni entrega sus recursos. Cuando el acceso está autorizado,
la respuesta contiene URLs temporales para los recursos. Una URL firmada es utilizable por
quien la tenga hasta su vencimiento; no depende del Bearer durante la descarga CDN.
Las portadas y avatares nuevos usan `/public/` y no llevan firma ni vencimiento temporal.

La API envía `Cache-Control: private, no-store`. El cliente debe volver a consultar la API para
renovar enlaces vencidos y evitar persistirlos como referencias definitivas. La caché en memoria
del frontend también debe respetar ese plazo; el header HTTP no invalida un estado JS ya cargado.
La política de caché de objetos en CloudFront se configura por separado.
En local, `/files` sigue siendo público, sin Bearer; no proporciona la protección de CloudFront.

## Sustitución, referencias y despliegue

Al sustituir avatar o portada se guarda el objeto nuevo, se actualiza la fila y después se
intenta retirar el anterior. Recursos compartidos por cursos duplicados consultan referencias
antes del borrado. Base y storage no forman una transacción distribuida; puede quedar limpieza
pendiente. Los services conservan sus reglas de compensación.

Antes de cambiar de local a S3, copiar los bytes bajo sus claves originales y revisar filas sin
clave. No basta con cambiar el driver. Con local, persistir y respaldar la carpeta junto a la base.
Los archivos Vimeo/YouTube no se suben por este puerto.

Los tests usan S3 simulado y claves RSA efímeras: validan comandos, bytes, MIME, errores, firma
SHA256, recurso exacto, renovación y configuración. Eso no acredita permisos ni una distribución
real. Verificar en el entorno final subida/lectura/borrado y que enlaces sin firma, alterados o
vencidos devuelvan 403, también con objetos previamente cacheados. Ver
[planificación de archivos](planning/storage/README.md) y [entorno](ENV.md).

## Prueba real de desarrollo

El 2026-10-19 se verificó `arxatec-academy-product-development` con
`https://cdn.dev.academy.arxatec.net`: subida/lectura/borrado S3, MIME y bytes; `/public/`
sin firma 200; `/private/` firmado 200, sin firma 403, firma alterada 403 y vencimiento real 403.
El origen S3 rechazó lectura anónima con 403 en ambos roots. Se borraron los tres fixtures
y se confirmó 404 en S3. La clave privada y las credenciales se mantuvieron fuera de los logs.

Repetir con `pnpm storage:check:development`. El script compila primero, exige entorno y bucket
de desarrollo, genera nombres únicos y limpia solo sus fixtures incluso ante fallo. No toca la DB
ni cambia políticas AWS. El TTL habitual sigue en 300 s; el caso de vencimiento usa un enlace
adicional de 4 s. El SDK redondea el vencimiento a segundos.

El CDN devolvió `Miss from cloudfront` en las lecturas: no se acredita un hit de caché caliente.
Tampoco devolvió Access-Control-Allow-Origin para el origen frontend de la prueba; si se incorporan
descargas mediante fetch/blob será necesario configurar CORS. Los enlaces de navegación no
requieren ese permiso. La renovación de enlaces en memoria del frontend se verifica aparte.
