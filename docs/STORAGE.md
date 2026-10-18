# Archivos de Academy

Portadas, recursos de lección y avatares usan `StoragePort` con `save`, `remove` y `publicUrl`.
El driver local está implementado. El adaptador S3 lanza un error al utilizar cualquiera de
sus operaciones; configurar credenciales AWS no lo convierte en una integración operativa.
Fuentes: [puerto](../src/infrastructure/storage/storage.types.ts),
[local](../src/infrastructure/storage/local_storage.adapter.ts) y
[S3](../src/infrastructure/storage/s3_storage.adapter.ts).

## Contratos de subida

| Uso                | Ruta bajo `/api/v1`                        | Formato permitido                 | Tamaño máximo |
| ------------------ | ------------------------------------------ | --------------------------------- | ------------- |
| Avatar propio      | `PUT /me/avatar`                           | JPEG, PNG                         | 2 MiB         |
| Portada de curso   | `PUT /admin/courses/:id/cover`             | JPEG, PNG, WebP                   | 5 MiB         |
| Recurso de lección | `POST /admin/lessons/:lesson_id/resources` | PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX | 20 MiB        |

Enviar multipart con un único campo `file`; el recurso exige también `title`.
Multer mantiene el archivo en memoria. `validateUpload` comprueba el tamaño, la lista de MIME
y la firma binaria. Un nombre o una extensión por sí solos no son evidencia de tipo.
Las firmas ZIP/OLE identifican el contenedor Office, no inspeccionan su contenido completo.

La portada debe ser horizontal, de al menos 1200 × 750 píxeles. `IMAGE_TOO_SMALL` devuelve
`422`; MIME/firma no admitidos, `415 INVALID_FILE_TYPE`; tamaño excesivo,
`413 FILE_TOO_LARGE`. Un multipart mal formado puede devolver `400 VALIDATION_ERROR`.
Las políticas están en [files](../src/constants/files.ts) y
[courses](../src/constants/courses.ts).

## Rutas, claves y persistencia

El servidor genera claves con prefijos `avatars/`, `course_covers/` y `lesson_resources/`.
El adaptador rechaza claves inseguras antes de resolverlas dentro de `STORAGE_LOCAL_PATH`.
La URL pública concatena `STORAGE_PUBLIC_URL` con la clave; `/files` sirve esa carpeta con
índices desactivados y dotfiles denegados cuando el driver es local.

La base conserva URL y clave por separado: `avatar_url/avatar_key`,
`cover_image_url/cover_image_key` y `file_url/file_key`. La clave es metadato interno para borrar
el objeto; no es una credencial ni vuelve privada la URL. Cambiar `STORAGE_PUBLIC_URL` no
reescribe URLs ya persistidas. Hay que planificar la migración de esos datos al mover el dominio.

## Sustitución, referencias y borrado

Al sustituir un avatar o portada, se guarda el objeto nuevo y se actualiza la fila; después se
intenta retirar el anterior. Si falla esa última limpieza se registra el fallo. En recursos,
el borrado consulta referencias por `file_key`: un curso duplicado puede compartir el archivo.
No retirar el objeto mientras otra lección lo use.

La semilla reconstruye metadatos de recursos a partir de claves de ejemplo y no sube sus bytes.
Una URL generada por la semilla no prueba que exista un archivo. El mismo criterio se aplica a
los ids Vimeo de demostración: los videos son del proveedor, no de este almacenamiento.

## Acceso y despliegue

`/files` es público. Una lección bloqueada no incluye recursos en su DTO, pero quien conozca una
URL local puede descargarla sin Bearer. Academy no implementa URLs CDN firmadas, presigned
uploads, caducidad de enlaces ni un endpoint de descarga autenticada. Por eso la guía de CDN
privado de Admin se adapta aquí a este documento y a su alcance real.

En despliegue local, persistir y respaldar la carpeta junto con la base; coordinar su restauración
para no dejar metadatos sin bytes. Varias réplicas necesitan acceso al mismo almacenamiento.
El proxy debe conservar la ruta pública y permitir los tamaños multipart previstos.

Para incorporar S3 o recursos privados se necesita implementar y probar el adaptador, definir
acceso y limpieza de objetos compartidos, migrar URLs/claves existentes y verificar permisos
reales. Los criterios se detallan en [planificación de archivos](planning/storage/README.md).
