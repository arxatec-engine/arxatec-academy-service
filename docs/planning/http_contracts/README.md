# Contratos HTTP transversales

**Estado:** convenciones de los endpoints implementados, con diferencias de paginación
explícitas. [API completa](../../API.md) · [Índice](../README.md).
Fuentes: [rutas](../../../src/routes/index.ts), [endpoints](../../../src/constants/endpoints.ts)
y schemas de cada área.

## Prefijos, identidad y transporte

La API usa `/api/v1`. `/auth` abre/gestiona sesión; `/courses` expone catálogo y contenido;
`/me` opera sobre la cuenta; `/lessons` y `/comments` reciben ids de operaciones;
`/notifications` permite altas públicas. Todo `/admin` exige JWT Bearer activo y rol ADMIN
persistido en Academy. El actor nunca viene de un user_id elegido por el cliente.

Los enlaces públicos de curso/lección usan slugs y las operaciones/editor ids. Los ids Prisma
son cuid, no UUID. Cada schema determina su validación; no hay un validador global que obligue
a que todo string de id tenga exactamente la forma cuid.

La respuesta JSON estándar contiene status, message, description, timestamp, path y data/meta
cuando aplican. DTOs usan snake_case. El cliente decide por `meta.code`, no por el texto de
description. Errores de campo llevan claves i18n en meta.fields.

```json
{
  "status": 200,
  "message": "OK",
  "description": "Consulta completada",
  "timestamp": "2026-10-16T12:00:00.000Z",
  "path": "/api/v1/me/courses",
  "data": { "in_progress": [], "completed": [] }
}
```

Es un ejemplo estructural; los textos reales están en las constantes de mensajes. Las
redirecciones Google usan 302; el CSV usa bytes UTF-8 con BOM; las bajas de cuenta, lección,
recurso y suscriptor con éxito 204 no contienen sobre. Quitar avatar y logout responden 200.
`/ping` y `/files` están fuera del sobre de la API.

## Paginación y vacíos

No hay una paginación universal que pueda copiarse de Admin.

| Superficie                         | Query                           | Respuesta                                                                   |
| ---------------------------------- | ------------------------------- | --------------------------------------------------------------------------- |
| Directorio                         | page=1, per_page=25; máximo 100 | data.users/data.stats y meta.pagination con page/per_page/total/total_pages |
| Moderación                         | page=1, page_size=20; máximo 50 | data.comments/data.counts/data.pagination con page/page_size/total/has_next |
| Avisos                             | page=1, per_page=25; máximo 100 | data.signups/data.pagination con page/per_page/total/has_next               |
| Catálogo, cursos admin, Mis cursos | Sin paginación declarada        | Arrays completos de esa proyección                                          |
| Hilo público y temas agrupados     | Sin paginación declarada        | Hilos/temas completos                                                       |

Un conjunto vacío válido responde 200 con arrays vacíos. El directorio calcula total_pages=0
si no hay filas; las otras páginas usan has_next=false. No rellenar con datos de demostración
ni convertir vacío en 404. Un detalle inexistente sí es 404.

## Filtros y validación

Los schemas suelen usar z.object y eliminan claves desconocidas. No se promete el rechazo
estricto de query/body adicional de Admin. Especificar únicamente los campos declarados y
mantener tipos exactos: booleanos JSON en bodies; true/false de texto en filtros que los admiten.

Catálogo y directorio admiten arrays por coma o parámetros repetidos en sus enums múltiples.
Catálogo search máximo 120; directorio search máximo 120; cada acción tiene normalización
propia. No enviar ALL como tema de curso: es una clave de faceta, no un enum de filtro.

Directorio recibe fechas YYYY-MM-DD con offset fijo de reportes; el día final es inclusivo.
Autoguardado y marcado de avisos reciben instantes ISO, con validadores distintos. No trasladar
el par from/toExclusive y timezone de Admin a rutas que no lo aceptan.

## Concurrencia y confirmaciones

PATCH de curso exige expected_updated_at y devuelve STALE_UPDATE si ha cambiado. Ordenar
catálogo exige todos los ids activos; lecciones/recursos exigen todos los ids de su conjunto.
No existe commandKey ni receipt de idempotencia general.

Cambio de tipo con contenido devuelve 409 y data.will_discard para confirmar; borrar una
lección borrador con datos de alumnos devuelve conteos y exige confirm_destroys_student_data.
No ocultar esas respuestas en un genérico «error inesperado» de frontend.

El progreso conserva el máximo bajo escrituras concurrentes. Repetición tiene semántica por
acción: inscribirse no duplica; un pedido de tema incrementa; publicar curso ya publicado
devuelve estado; marcar aviso no reenvía nada. HTTP 200 no implica que toda acción sea un no-op.

## Errores y disponibilidad

400 para token inválido/JSON mal formado; 401 para credenciales/sesión; 403 para permiso,
verificación o lección bloqueada; 404 para ausencia; 409 para conflicto; 413 para tamaño;
415 para MIME/firma; 422 para schema/contenido; 429 para cuota; 500 para fallo inesperado y
502 para probe de proveedor no disponible. El catálogo completo está en [API](../../API.md).

La lección bloqueada es un 403 con data pública. Un PATCH de video puede guardar borrador y
responder 200 con meta.code VIDEO_PROVIDER_UNAVAILABLE; no tratar todos los meta.code como
errores HTTP. Las respuestas exitosas de verificación repetida también llevan código.

No hay contrato de degradación parcial de métricas como en Admin: una consulta Prisma fallida
no se convierte automáticamente en cero o lista vacía. No se exponen stacks ni errores SQL
en el JSON. Los CSV conservan el sobre estándar cuando la operación falla.

## Criterios de compatibilidad

Comparar payloads de frontend con schemas reales, manteniendo nombres y ubicación de
paginación. Verificar acceso antes de acciones y archivos, campos secretos ausentes, vacíos,
conflictos y 204 sin body. Cambiar una forma requiere actualizar API y consumidores, no solo
el texto de este plan. Las pruebas y límites están en [TESTING](../../TESTING.md).
