# Almacenamiento: alcance y evolución

**Estado:** driver local operativo; S3 pendiente. [Contrato de archivos](../../STORAGE.md) ·
[Índice](../README.md). Este plan reemplaza los requisitos de CDN privado de Admin por los usos
reales de Academy.

## Fuentes y propiedad

| Uso     | Metadatos PostgreSQL                                        | Quién escribe             |
| ------- | ----------------------------------------------------------- | ------------------------- |
| Avatar  | users.avatar_url y avatar_key                               | Cuenta autenticada propia |
| Portada | courses.cover_image_url y cover_image_key                   | ADMIN                     |
| Recurso | lesson_resources: URL, clave, MIME, bytes, título, posición | ADMIN                     |

Los bytes locales viven fuera de PostgreSQL, en STORAGE_LOCAL_PATH. La clave generada permite
limpieza; la URL entrega acceso público. No existe una tabla de reservas, estados de subida
ni confirmación posterior de objetos como en el módulo financiero de Admin.

## Flujo implementado

Autenticar/autorizar antes de multipart; Multer recibe un archivo en memoria; el service valida
tamaño, MIME y firma; el puerto escribe; la operación guarda metadatos y devuelve un DTO.
Si falla la persistencia tras un guardado, los services de subida intentan retirar el archivo.
La sustitución limpia la referencia previa después de guardar la nueva.

Portada exige orientación horizontal y al menos 1200 × 750. Avatar admite JPEG/PNG hasta 2 MiB;
portada JPEG/PNG/WebP hasta 5 MiB; documentos de recurso PDF/Office hasta 20 MiB. Los recursos
usan título y posición única por lección. No hay carga de videos en ese puerto.

## Objetos compartidos y consistencia

Duplicar curso puede copiar metadatos que comparten el mismo file_key. Quitar un recurso o
lección revisa referencias antes de eliminar el archivo. No tratar cada fila como propietaria
exclusiva de los bytes. Filas antiguas pueden tener file_key null y solo URL; no es válido
deducir una clave arbitraria y borrarla sin una migración controlada.

Base y filesystem no forman una transacción distribuida. Un fallo puede dejar un archivo
huérfano o una limpieza pendiente en logs. Una reconciliación futura necesita comprobar
referencias y pertenencia; no borrar todo objeto que un listado parcial no contenga.

## Acceso público y futuro S3

La lección bloqueada oculta recursos en JSON, pero `/files` no verifica sesión. Una necesidad
de recursos privados requiere decidir el contrato: autorización de descarga, entrega temporal,
política CDN/bucket, expiración y caches. No copiar variables CloudFront de Admin sin ese diseño.

Para cerrar S3 se necesita implementar las tres operaciones del puerto, probar key/MIME/bytes,
permisos y errores, acordar URL pública o descarga autorizada y migrar referencias existentes.
Configurar las cuatro AWS exigidas por el schema solo valida presencia; el adaptador actual
continúa lanzando error. No incluir un cambio de driver en un deploy antes de completar eso.

## Despliegue y aceptación

Persistir la carpeta entre releases y restaurar base/archivos de manera coordinada. Probar
permisos de escritura, URL desde navegador, bytes de subida, reemplazo y borrado compartido.
Varias réplicas requieren un almacenamiento común. El seed de recursos no crea los bytes:
no tomar sus URLs como prueba de lectura.

Los tests locales cubren claves seguras y validación sin una cuenta AWS. Integración editorial
cubre los metadatos y limpieza del flujo local. Probar S3 real, distribución o acceso firmado
será evidencia adicional cuando existan. Medir memoria de subidas concurrentes antes de
aumentar los límites; Multer mantiene buffers completos.
