# `GET /courses/:slug` — el porqué

La ficha de curso de la pantalla 02 del brief, que se llama literalmente _"Temario completo sin
cuenta"_. Devuelve el curso y **sus lecciones enteras** —título, descripción, tipo y duración— a
cualquiera, con o sin sesión. Lo único que cambia cuando hay sesión es un booleano.

`course.teacher` contiene `full_name`, `biography` y `photo_url`, o `null` cuando el curso no
tiene docente asignado. La ficha pública no expone el id del perfil. La relación se administra
desde la edición del curso y un mismo docente puede aparecer en varios cursos.

## 1. El recorrido

```text
GET /api/v1/courses/:slug            (Bearer opcional)
  → optionalAuthenticate             Bearer válido → req.user; roto o ausente → anónimo, sin fallar
  → getDetailController              sesión → parse → service → sobre
  → getDetailSchema.parse            slug de la ruta + has_session (booleano, no el usuario)
  → getDetailService                 regla: sin curso publicado, 404
  → courses.repository               shared/data: curso por slug + lecciones publicadas
  → toApiCourseDetail / toApiLessonSummary
  → 200 { … data: { course, lessons } }
```

| Paso                                      | Archivo                                                         |
| ----------------------------------------- | --------------------------------------------------------------- |
| cadena de la ruta                         | `presentation/get_detail.routes.ts:9`                           |
| sesión → validación → service → respuesta | `presentation/get_detail.controller.ts:11-17`                   |
| regla de negocio                          | `presentation/get_detail.service.ts:18-38`                      |
| persistencia                              | `src/modules/courses/shared/data/courses.repository.ts:159-172` |

## 2. El temario entero es público; el contenido, no

Es la decisión central de la fase 09, y viene del brief: la pantalla 02 enseña las seis lecciones
con su título, tipo, duración y descripción, **con un candado en las cinco que no son muestra**.
Un temario escondido no vende el curso; un contenido abierto no deja nada que vender.

Lo que sale y lo que no está decidido **en el `select`, no en un borrado posterior**:

| Sale                                               | No sale                               | Por qué                                                             |
| -------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------- |
| `slug`, `title`, `description`, `type`, `position` | `article_body`                        | es el contenido: lo entrega la fase 10, y solo a quien tenga acceso |
| `duration_seconds`, `reading_minutes`              | `transcript`                          | ídem; además es la red de E6 en la pantalla de lección              |
| `is_free_sample`, `is_unlocked`                    | `video_provider`, `video_external_id` | con el id del video, el candado se salta abriendo Vimeo             |

`LESSON_SUMMARY_SELECT` (`src/modules/courses/shared/data/courses.repository.ts:43-52`) es la lista
de las ocho columnas que se piden. Los cuatro campos prohibidos **nunca se leen de la base**, así
que no hay nada que borrar más adelante y no existe el fallo clásico: añadir un campo al `select`
y olvidarse de añadirlo a la lista de campos que se limpian antes de responder. `toApiLessonSummary`
(`src/modules/courses/shared/domain/course_mapper.ts:43-56`) es la segunda barrera: construye el
objeto campo a campo, así que exponer algo nuevo exige escribirlo a propósito.

El test `test/get_detail.controller.test.ts` lo comprueba **sobre el JSON serializado**, buscando
las cadenas `article_body`, `transcript`, `video_provider` y `video_external_id` en la respuesta —
no sobre las claves del objeto, que es donde un campo anidado se escapa.

## 3. `is_unlocked` es lo único que cambia con la sesión

```text
is_unlocked = canViewLesson({ is_free_sample, has_session })
```

(`presentation/get_detail.service.ts:32-35`). Desde la fase 10 la expresión no se escribe aquí:
la decide `canViewLesson` (`src/modules/courses/shared/policy/lesson_access.ts:6-7`), que es la
misma función que usa el `403 LESSON_LOCKED` de la lección. Una sola regla, un solo archivo. La muestra gratuita está desbloqueada para todo el
mundo; el resto, para cualquiera con sesión válida. **La verificación del correo no pinta nada
aquí** (D-006 de `08_decisiones.md`): verificar solo hace falta para
comentar.

`is_unlocked` **no entrega contenido**: dice si la pantalla pinta candado o botón. El contenido lo
sirve la fase 10 y vuelve a decidir por su cuenta; este booleano no es una autorización, es una
etiqueta de interfaz.

El controller **no pasa el usuario al service, pasa un booleano**
(`presentation/get_detail.controller.ts:12-16`). El service no necesita saber quién es —no hay
progreso, ni inscripción, ni nada por usuario en esta respuesta—, y un payload que no lleva el id
del usuario es un payload que no puede filtrarlo por error.

## 4. Borrador, archivado e inexistente: el mismo `404`

`findPublishedCourseBySlug` filtra por `status: PUBLISHED` en la propia consulta
(`src/modules/courses/shared/data/courses.repository.ts:159-163`), así que un curso en borrador o
archivado devuelve `null` y el service lanza `404 NOT_FOUND`
(`presentation/get_detail.service.ts:21-25`) — **el mismo que un slug que no existe**.

Es deliberado: un `403` en un borrador le confirmaría a cualquiera que ese slug existe y está por
publicarse. El slug es contenido editorial y se elige antes de anunciar el curso; filtrarlo es
filtrar el calendario de lanzamientos.

## 5. El curso publicado sin lecciones publicadas responde `200`

Es la mitad pública de E4: _"El temario se publica el 3 de setiembre. Este curso ya tiene fecha."_
Con la invariante de la fase 08 no debería existir, salvo que se despublique la última lección de
un curso ya publicado (la fase 15 lo permite). El endpoint responde `200` con `lessons: []` y
`lesson_count: 0`, y el frontend pinta esa pantalla. **No es un `404`: el curso existe y tiene
fecha.**

`summarizeLessons([])` devuelve ceros sin ramas especiales
(`src/modules/courses/shared/domain/course_totals.ts:26-34`).

## 6. Los contadores salen del temario, no de un segundo `groupBy`

`lesson_count`, `video_count`, `article_count` y `total_duration_seconds` se calculan sobre la
lista de lecciones que ya se ha traído (`presentation/get_detail.service.ts:30`). El catálogo sí
usa un `groupBy` porque allí no se traen las lecciones; aquí traerlas **es** la respuesta, y
pedirle a PostgreSQL que las cuente otra vez sería una segunda consulta para un dato que ya está
en memoria y garantizado consistente con la lista que se devuelve.

`video_count` y `article_count` existen porque la pantalla 02 los pinta: _"6 lecciones · 1 h 10 min
· 4 videos, 2 artículos"_.

## 7. Los tests

- `test/get_detail.service.test.ts` — los contadores, el `404` con su `meta.code`, que no consulta
  las lecciones si el curso no existe, el temario vacío de E4 y los dos estados de `is_unlocked`.
- `test/get_detail.controller.test.ts` — el router real con Supertest y el middleware
  `optionalAuthenticate` **de verdad**, con la sesión mockeada: sin cabecera, con Bearer válido,
  con Bearer caducado (`200` anónimo, no `401`), con sesión revocada y con basura. En todos, la
  comprobación de que el JSON serializado no lleva contenido.
