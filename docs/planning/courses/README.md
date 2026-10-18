# Cursos: catálogo y administración editorial

**Estado:** implementado. [Catálogo](../../../src/modules/courses/features/catalog/docs/README.md) ·
[Editor](../../../src/modules/courses/features/admin_courses/docs/README.md) · [Índice](../README.md).

## Datos y selección

`courses` guarda slug, título, descripciones, tema, nivel, portada, estado, orden y fechas.
El DTO del catálogo omite el id interno y la descripción larga; la ficha devuelve descripción
larga y totales de contenido. El temario publica `lesson.id` para operaciones de aprendizaje.
No se entrega contenido de borradores por un endpoint público.

Temas: FIRST_STEPS, LEGAL_ENGINEERING, APPLIED_AI y ARXATEC_PRODUCT. Niveles: INTRODUCTORY e
INTERMEDIATE. El estado editorial es DRAFT, PUBLISHED o ARCHIVED. Publicación y archivo se
resuelven mediante comandos, no aceptando un estado arbitrario en el PATCH.

## Catálogo público

`GET /api/v1/courses` acepta `topic`, `level` y `search`. Los enums permiten valores repetidos
o separados por coma; búsqueda recorta espacios, toma el primer valor y limita a 120 caracteres.
Busca sin distinguir mayúsculas/acentos sobre título y descripción corta. La lista se ordena
por `catalog_order` y no está paginada.

Respuesta `data: { courses, facets }`. Cada tarjeta tiene slug, título, descripción corta, tema,
nivel, portada nullable, `lesson_count` y `total_duration_seconds`. Las facetas de tema incluyen
ALL y las cuatro claves; las de nivel incluyen las dos claves incluso cuando cuentan cero.

| Faceta             | Aplica               | Omite            |
| ------------------ | -------------------- | ---------------- |
| `facets.topic`     | Nivel                | Tema y búsqueda  |
| `facets.level`     | Tema                 | Nivel y búsqueda |
| `facets.topic.ALL` | Nivel; suma de temas | Tema y búsqueda  |

Un resultado vacío es 200. `GET /courses/:slug` devuelve `{ course, lessons }` publicado y
`is_unlocked` según muestra/sesión, sin exigir inscripción. Totales se agregan sobre lecciones
publicadas y mezclan segundos de video con minutos de artículo convertidos a segundos.

## Editor: contratos y campos

Todas las rutas `/api/v1/admin/courses` exigen sesión activa y rol ADMIN.

| Acción               | Entrada                                       | Resultado                                                   |
| -------------------- | --------------------------------------------- | ----------------------------------------------------------- |
| Listar               | Sin filtros/paginación implementados          | courses y counts globales por estado                        |
| Crear                | title, topic, level; descripciones opcionales | 201 con course y lessons; borrador con slug generado        |
| Leer                 | id                                            | course y lessons de editor, incluidos borradores            |
| Autoguardar          | expected_updated_at más campos permitidos     | 200 con nueva fecha o 409 STALE_UPDATE                      |
| Publicar/despublicar | id, POST al comando                           | Ficha actualizada                                           |
| Duplicar             | id                                            | 201; título con sufijo, slug propio y contenido en borrador |
| Archivar             | id                                            | Ficha ARCHIVED, conserva aprendizaje                        |
| Reordenar            | course_ids completos                          | Lista administrativa actualizada                            |
| Portada              | Multipart file                                | Ficha con URL de portada                                    |

Título máximo 140; slug y slug generado máximo 160; descripción corta máximo 140. PATCH permite
título, slug, ambas descripciones, tema, nivel y `catalog_order` positivo. El cuerpo exige
`expected_updated_at` ISO; la escritura condicionada compara ese instante. Campos y movimiento
de orden se agrupan cuando se envían juntos.

El DTO de editor incluye `slug_locked`, `can_publish`, `updated_at` y `published_at`.
`can_publish` solo refleja el mínimo de lecciones publicadas; no certifica las descripciones,
que el comando valida aparte. Las claves de almacenamiento no forman parte del DTO público.

## Transiciones e invariantes

Publicar requiere al menos una lección publicada y ambas descripciones no vacías. Un archivado
no se publica directamente; el comando de despublicar lo deja DRAFT y conserva `published_at`.
Una vez sellada la primera publicación, el slug queda bloqueado incluso tras volver a borrador.
Repetir publicación de un curso ya publicado devuelve su estado.

El orden completo incluye cursos activos (DRAFT/PUBLISHED), sin archivados, y rechaza un conjunto
obsoleto con `STALE_CATALOG_ORDER`. Archivar ajusta el catálogo sin borrar progreso. Duplicar
copia lecciones y recursos, pero no inscripciones ni comentarios; puede compartir archivos
mediante sus claves. La portada exige 1200 × 750 horizontal; límites en [archivos](../../STORAGE.md).

## Consultas y aceptación

Los repositorios separados de público/editor viven en
[courses/shared/data](../../../src/modules/courses/shared/data). La búsqueda de catálogo se
normaliza en memoria y las facetas tienen consultas propias. No se debe paginar primero y
recortar después; el crecimiento requiere revisar consulta e índices.

[admin_courses_flow](../../../tests/integration/postgres/admin_courses_flow.test.ts) comprueba
flujo, conflicto de fecha y estados; los unitarios cubren facetas/mappers. Aceptación: borradores
ausentes del público, slug estable después de publicar, orden completo sin duplicados y archivo
sin pérdida de aprendizaje. Los comandos agrupados mantienen pendiente su separación por acción;
no tienen recibos idempotentes generales ni auditoría de contenido como Admin.
