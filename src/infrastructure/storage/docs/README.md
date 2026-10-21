# Almacenamiento de archivos

Los services validan las subidas y coordinan persistencia. Esta unidad escribe bytes, elimina
objetos y construye enlaces. El contrato y la operación se describen en
[STORAGE](../../../../docs/STORAGE.md) y [ENV](../../../../docs/ENV.md).

## Puerto y selección

[StoragePort](../storage.types.ts) expone cuatro operaciones:

| Operación                           | Resultado                                                         |
| ----------------------------------- | ----------------------------------------------------------------- |
| `save({ key, content, mime_type })` | Bytes guardados y metadatos con URL canónica estable              |
| `remove(key)`                       | Borra el objeto; no decide si otras filas aún lo referencian      |
| `publicUrl(key)`                    | URL estable para persistencia/semilla; no contiene firma temporal |
| `readUrl(key)`                      | URL para entregar al consumidor; firmada con S3/CloudFront        |

[storage.ts](../storage.ts) elige una vez según `STORAGE_DRIVER`.
[Local](../local_storage.adapter.ts) usa filesystem y sirve `/files` públicamente.
[S3](../s3_storage.adapter.ts) usa AWS SDK v3 y CloudFront con firma RSA SHA256.
El cliente AWS puede inyectarse en tests; las credenciales explícitas son opcionales para
permitir IAM/default credential chain. No se envía ACL pública.

## Lectura y persistencia

[resolveStoredFileUrl](../file_url.ts) transforma URL/claves ya autorizadas por los services.
Los mappers reciben ese resolver explícitamente, conservan el contrato HTTP y no exponen claves.
La consulta de una lección bloqueada no incluye recursos. Una fila con clave nula conserva
su URL externa/legacy; no se extraen claves de direcciones arbitrarias.

La DB conserva URLs estables; S3 entrega `/public/` sin firma y firma `/private/` con TTL configurable
(300 segundos por defecto). Los enlaces firmados nunca son el resultado persistible de `save`.
No hay fallback a un objeto público si falla la firma. La API usa `private, no-store`.

## Validación y errores

[storage_key.ts](../storage_key.ts) limita las claves a prefijo y nombre generado.
[validate_upload.ts](../validate_upload.ts) valida tamaño, MIME y firma binaria antes de escribir.
Los límites están en [files](../../../constants/files.ts).
[storage_env.ts](../../../config/storage_env.ts) exige región, bucket, base CDN HTTPS y una única
fuente de clave privada al activar S3; valida el par opcional de credenciales AWS y el TTL.
El adaptador carga y valida el PEM al construirse. Un PEM inválido impide el inicio.
Errores de operación AWS o de firma devuelven `503 STORAGE_UNAVAILABLE`, sin detalles sensibles.

## Limpieza tras borrados y reemplazos

[cleanup](../cleanup.ts) elimina objetos que dejan de usarse y
[cleanup.repository](../cleanup.repository.ts) mantiene la cola persistida en PostgreSQL.
Los triggers instalados por `20261021030000_storage_deletions` capturan las claves anteriores
al borrar o sustituir recursos, portadas y avatares; incluyen cascadas y respetan rollbacks.
Los services intentan la limpieza inmediatamente y el servidor recupera lo pendiente al iniciar
y cada 30 segundos. La reserva de dos minutos se recupera si muere un proceso; los fallos se
reintentan con espera creciente, sin perder el trabajo tras reiniciar.

Antes de `remove` se comprueban referencias en los tres tipos de archivo. No se deducen claves
de URLs externas, no se eliminan objetos aún compartidos y archivar un curso conserva su contenido.
Las compensaciones de subidas fallidas usan la misma cola si la DB permite registrarlas.
El despliegue debe aplicar la migración, no solo generar el cliente o ejecutar `db push`.

[storage_cleanup_flow](../../../../tests/integration/postgres/storage_cleanup_flow.test.ts)
comprueba con PostgreSQL y filesystem reales las cascadas, referencias compartidas, sustituciones,
fallos recuperables, reservas entre workers y rollbacks en una base desechable.

## Evidencia

[test](../test/) cubre filesystem, validación de subidas, comandos S3, claves inseguras,
configuración y verificación criptográfica de enlaces usando RSA efímera.
La infraestructura AWS requiere comprobaciones reales aparte: OAC, grupo confiable, permisos,
CORS, objetos migrados y denegación de enlaces sin firma/alterados/vencidos.

Las subidas nuevas usan `public/avatars`, `public/course_covers` o `private/lesson_resources`.
Las variables de producto de Academy se normalizan a los nombres genéricos antes de validar.
La prueba real de desarrollo se ejecuta con `pnpm storage:check:development`, usa fixtures
útiles solo para el chequeo y los elimina incluso si falla. Resultados y límites en STORAGE.
