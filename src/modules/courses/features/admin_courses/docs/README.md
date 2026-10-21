# Administración de cursos

`admin_courses.routes.ts` monta las diez operaciones del editor bajo `/api/v1/admin/courses`.
El router exige sesión y rol `ADMIN` antes de registrar las acciones. `admin_courses.schema.ts`
valida las entradas; controller construye el sobre HTTP y service aplica las transiciones.
El repositorio compartido selecciona columnas explícitas y mantiene las escrituras de duplicado,
archivo y orden en transacciones.

El slug se deriva del título al crear o duplicar y se desambigua con sufijos. Tras la primera
publicación (`published_at` no nulo), cambiarlo devuelve `SLUG_LOCKED`, incluso si el curso se
despublica. El autoguardado exige `expected_updated_at`; un `PATCH` obsoleto devuelve
`STALE_UPDATE`. Si el mismo `PATCH` cambia también `catalog_order`, campos y orden se escriben
en una sola transacción. Publicar requiere una lección publicada y descripciones completas.
Archivar oculta del catálogo, no borra progreso. El duplicado copia lecciones y recursos como
borradores. La portada exige PNG/JPEG/WebP horizontal de al menos 1200 × 750 píxeles; su clave
privada permite retirar la anterior tras sustituirla.
La portada anterior se registra en la cola de limpieza dentro de la transacción del reemplazo;
si S3 falla, el servidor la reintenta. El borrado real de una fila de curso también registra su
portada y los recursos de las lecciones eliminadas en cascada. Archivar conserva esos archivos.

La integración real está en `tests/integration/postgres/admin_courses_flow.test.ts`. El guion
`scripts/smoke_backend.sh` recorre creación, edición, portada, publicación y archivo con `curl`.

Pendiente estructural: hoy las acciones comparten controller/service por feature; el harness
pide un directorio y README por action. Separarlas no debe cambiar las rutas ni el contrato.

El `PATCH` también acepta `teacher: { id?, full_name, biography, photo_url }` o `teacher: null`.
Sin id crea un registro de `teachers`; con id actualiza y asigna ese docente existente. Un valor
nulo desasigna el docente conservando su registro. Nombre (120) y biografía (2000) son obligatorios;
la foto es una URL HTTP(S) de hasta 2048 caracteres o nula. La fila del curso y el perfil se
escriben en la misma transacción, después de comprobar `expected_updated_at`. Una edición
obsoleta no crea docentes huérfanos. Un docente puede estar asociado a varios cursos y el
duplicado conserva la asociación. El listado disponible está en `GET /admin/teachers`.
