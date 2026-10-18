# Inscripciones y progreso de aprendizaje

**Estado:** implementado. [Módulo](../../../src/modules/progress/docs/README.md) ·
[Reglas compartidas](../../../src/modules/progress/shared/docs/README.md) · [Índice](../README.md).
Todos los comandos de progreso requieren sesión, sin exigir correo verificado.

## Datos y contrato

`enrollments` tiene una fila por usuario/curso y conserva started_at, completed_at y última
lección. `lesson_progress` tiene una fila por usuario/lección con posición y completed_at.
Las rutas reciben el usuario desde la sesión; no permiten elegir a otro alumno en el body.

| Método/ruta bajo `/api/v1`            | Entrada                                         | `data` de éxito                                        |
| ------------------------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| `POST /courses/:slug/enroll`          | Sin campos requeridos de body                   | `{ enrollment }`, 200 incluso al repetir               |
| `PUT /lessons/:lesson_id/progress`    | last_position_seconds, completed opcional false | `{ progress }`                                         |
| `POST /lessons/:lesson_id/complete`   | Sin body requerido                              | `{ mark: { lesson_id, completed_at, enrollment } }`    |
| `DELETE /lessons/:lesson_id/complete` | Sin body requerido                              | `{ mark }` con completed_at null y enrollment nullable |
| `GET /me/courses`                     | Sin filtros declarados                          | `{ in_progress, completed }`                           |

Posición debe ser entero 0–86400. `completed` es booleano; no se convierte desde un string.
Los ids de lección tienen tope 64 en estas acciones. Guardar posición devuelve lesson_id,
last_position_seconds, completed_at nullable y updated_at. El endpoint tiene límite 1/s por
usuario; no aplicarlo como una cuota independiente por lección.

Enrollment publica referencia de curso por slug/título, fechas de inicio/cierre, contadores
de lecciones y next_lesson nullable por slug/título. No devuelve id interno de inscripción ni
de curso. Los enlaces del alumno siguen usando slugs.

## Acceso y disponibilidad

Inscribirse busca curso publicado por slug; inexistente/borrador/archivado da 404. Marcar por
id distingue lección inexistente (404) de una lección o curso ya no publicados (403 LESSON_LOCKED).
La sesión válida permite ver la lección, sin una inscripción previa obligatoria.

«Mis cursos» se construye desde inscripciones y solo muestra cursos publicados. Los archivados
conservan datos en PostgreSQL pero desaparecen de esa proyección. No confundir visibilidad actual
con eliminación del aprendizaje.

## Escritura concurrente y posición

Guardar usa tres pasos: `createMany(skipDuplicates)`, `updateMany` si la posición almacenada es
menor, y lectura del estado resultante. La unicidad usuario/lección evita dobles filas y la
guarda evita retrocesos por eventos de red fuera de orden. No sustituirlo por un upsert que
sobrescriba siempre la posición ni por un `select → if → insert` en Node.

`completed: true` invoca el mismo marcado que el comando de completar después de guardar.
Guardar solo una posición no declara por sí mismo el curso terminado. La inscripción explícita
es idempotente y completar también puede crearla si faltaba.

## Finalización y cambio de temario

El cálculo actual es `published_lesson_count > 0 && completed_lesson_count >= published_lesson_count`.
Los contadores visibles intersectan completadas con publicadas; una retirada no infla el
avance. next_lesson es la primera publicada sin completar, no necesariamente la contigua a la
última vista.

Completar inserta/marca progreso, asegura inscripción, actualiza última lección y cuenta las
completadas de la lista publicada recibida por la transacción. Esa lista se obtiene antes de
abrirla; no se promete un snapshot compartido con una publicación editorial concurrente.
La primera fecha de cierre se sella solo
si estaba null. Repetir marcado no reemplaza esa fecha.

Si se publica una lección nueva, el curso puede volver a in_progress sin borrar su fecha
anterior; al ponerse al día, esa fecha se conserva. En cambio, desmarcar explícitamente una
lección sí pone a null completed_at de progreso e inscripción, conservando la posición. La
próxima finalización podrá tener una fecha nueva. Esos dos casos no deben documentarse igual.

## Métricas, pruebas y evolución

`GET /me/summary` y directorio cuentan inscripciones con fecha de cierre persistida, sin
recalcular si están al día. [Métricas](../metrics/README.md) explica por qué puede diferir de
`GET /me/courses`. No atribuir duración vista exacta a la posición máxima: no es un historial
de reproducción ni registra cada intervalo consumido.

[progress_flow](../../../tests/integration/postgres/progress_flow.test.ts) prueba guardados
simultáneos, unicidad, máximo, nuevas lecciones y desmarcado contra PostgreSQL. Los unitarios
prueban reglas, mappers y controllers. La suite depende del curso sembrado y modifica estados;
requiere base desechable según [TESTING](../../TESTING.md).

No existen certificados, intentos de examen, notas ni analítica de retención. Añadirlos requiere
un modelo y contrato nuevos; no deducirlos de completed_at o last_position_seconds.
