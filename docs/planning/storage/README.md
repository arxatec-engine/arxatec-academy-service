# Almacenamiento: alcance y evolución

**Estado:** local y S3/CloudFront con `/public/` y `/private/` implementados. Pendiente configurar
los demás entornos y migrar archivos existentes. Desarrollo se verificó el 2026-10-19; ver [STORAGE](../../STORAGE.md). [Contrato](../../STORAGE.md) · [Índice](../README.md).

## Propiedad y flujo

| Uso     | Metadatos PostgreSQL                                         | Quién escribe             |
| ------- | ------------------------------------------------------------ | ------------------------- |
| Avatar  | users.avatar_url y avatar_key                                | Cuenta autenticada propia |
| Portada | courses.cover_image_url y cover_image_key                    | ADMIN                     |
| Recurso | lesson_resources: URL, clave, MIME, bytes, título y posición | ADMIN                     |

Autenticar/autorizar antes de multipart; validar tamaño, MIME y firma binaria; escribir bytes;
persistir URL canónica y clave. Al responder, generar `readUrl` desde la clave. Las respuestas
S3 llevan firmas temporales, nunca se persisten como referencia definitiva.
No hay presigned uploads, reservas ni estados de confirmación: la API sigue recibiendo los bytes.

## Consistencia y migración

Cursos duplicados pueden compartir `file_key`; borrar recursos/lecciones consulta referencias.
Base y almacenamiento no forman una transacción distribuida. Los services intentan compensar
fallos de persistencia y limpiar sustituciones; una limpieza fallida puede dejar objetos huérfanos.
No deducir claves arbitrarias desde URLs legacy ni eliminar objetos con un listado parcial.

Antes de activar S3, copiar los bytes locales manteniendo claves y revisar filas con clave nula.
El resolver usa el dominio vigente para las filas con clave, sin reescribir su URL persistida.
La semilla no sube bytes; sus URLs no acreditan existencia.

## Aceptación operativa pendiente

- Configurar región/bucket, rol IAM o credenciales, dominio HTTPS y PEM/ID de clave pública.
- Mantener bucket privado con OAC y exigir firmas en todos los comportamientos CDN pertinentes.
- Probar subida, descarga, MIME, sustitución, borrado y referencias compartidas con fixtures.
- Verificar 403 sin firma, firma alterada y enlace vencido, incluidos objetos cacheados.
- Comprobar CORS desde el frontend y renovación de enlaces al caducar; la API usa no-store.
- Medir memoria bajo subidas concurrentes: Multer mantiene buffers completos.

Los tests herméticos validan comandos y firma criptográfica; no acreditan permisos ni despliegue.
El driver local conserva `/files` público y necesita volumen y backup coordinados con la base.
