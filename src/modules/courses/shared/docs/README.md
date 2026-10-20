# `modules/courses/shared` — el suelo común del contenido

Aquí no hay endpoints. Hay tres cosas: **las reglas que la base de datos no puede garantizar
sola** (`policy/`), **las consultas del módulo** (`data/`) y **el modelo público** (`domain/`).

Las reglas están en `policy/` porque son **funciones puras**: sin Prisma, sin Express y sin
`AppError`. Tres son invariantes del modelo (contenido, posiciones, publicación) y las usan la
semilla y los slices de las fases 14 y 15; la cuarta, `lesson_access`, es una **regla de negocio
del producto** y la usan hoy los dos endpoints públicos que dependen de la sesión. Las consultas y
el mapper de curso los estrenó la fase 09; la fase 10 añadió aquí sus dos consultas y su mapper de
lección, **no un `data/` paralelo**. La fase 11 añadió `data/course_refs.repository.ts` (§5), que
es lo que este módulo le presta a `modules/progress`.

**Por qué las tres invariantes no lanzan `AppError`.** Devuelven un resultado discriminado
(`domain/lesson_content.types.ts:21-22,29`) con un motivo de `LessonContentIssues` /
`LessonPositionIssues` (`src/constants/courses.ts:14-24`). El motivo es del dominio; el código
HTTP es del transporte, y **quien lo elige es el slice**. Si la política lanzara ya un
`422 LESSON_INCOMPLETE`, esta fase estaría declarando códigos de error de la fase 15 —y
`fases_backend/README.md` reparte los códigos fase a fase justo para que eso no pase.

## 1. Una lección es de video **o** de artículo

`resolveLessonContent` (`policy/lesson_content_policy.ts:75-76`) recibe el borrador con su `type`
y devuelve **el conjunto completo de las seis columnas de contenido**, no solo las que tocan:

| `type`    | Exige                                                                               | Deja en `null`                                            |
| --------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `VIDEO`   | `video_provider`, `video_external_id` no vacío y `duration_seconds` entero positivo | `article_body`, `article_word_count`, `reading_minutes`   |
| `ARTICLE` | `article_body` con al menos una palabra fuera de las etiquetas                      | `video_provider`, `video_external_id`, `duration_seconds` |

**Que devuelva las seis columnas es el punto entero de la función.** El selector de tipo de la
pantalla 14b _"cambia el campo siguiente"_: cuando una lección pasa de video a artículo, los
campos del tipo viejo **se limpian**, no se quedan de recuerdo. Si la política devolviera solo
los campos del tipo nuevo, cada slice tendría que acordarse de poner los otros a `null` y el día
que uno se olvide quedará una lección de artículo que sigue diciendo que dura 11:04.
El punto de partida es `EMPTY_CONTENT` (`:12-19`) y encima se escribe lo del tipo declarado
(`:45-53`, `:64-72`): por construcción no puede salir una fila con los dos tipos llenos.

**`article_word_count` y `reading_minutes` no se piden: se calculan** (`:69-70`). Los cuenta
`countArticleWords` (`:24-28`) sobre el texto **sin etiquetas HTML** —el cuerpo viene del editor
enriquecido de 14b, así que `<p>` y `<strong>` no son palabras— y `computeReadingMinutes` (`:30-31`)
divide entre `CoursePolicy.reading_words_per_minute` redondeando hacia arriba, con un mínimo de
un minuto.

**Las 200 palabras por minuto no son un número inventado**: son las que reproducen exactamente el
_"Calculado: 6 min (1 180 palabras)"_ de la pantalla 14b, y hay un test que lo fija
(`test/lesson_content_policy.test.ts:144-146`). Si alguien cambia la constante, ese test se pone
rojo y obliga a mirar la pantalla antes que el código.

## 2. `position` es una secuencia sin huecos desde 1

`validateLessonPositions` (`policy/lesson_position_policy.ts:12`) comprueba que las posiciones de
un curso sean exactamente `1..n`, en cualquier orden de llegada, sin repetidos y sin huecos.
`resequenceLessonPositions` (`:7-10`) es la otra mitad: recibe **el orden completo** de ids y
devuelve el bloque renumerado desde 1.

**Reordenar es reescribir el bloque entero, no sumar y restar.** Mover la lección 5 a la posición
2 con `UPDATE ... position = position + 1` deja la tabla en un estado intermedio inválido en cada
paso, y con dos peticiones a la vez deja huecos permanentes. Por eso la firma pide la lista
entera: la fase 15 la escribe dentro de una transacción.

**La base de datos ayuda pero no basta.** `@@unique([course_id, position])`
(`prisma/schema/courses.prisma:47`) impide dos lecciones en la misma posición, y ahí se acaba lo
que sabe: no puede impedir `1, 2, 4`. Ese hueco es el que cubre esta función.

Consecuencia práctica que hereda la fase 15: como el índice único **no es diferible**, reescribir
el bloque en una transacción exige apartar antes las posiciones (por ejemplo a negativas) o el
`UPDATE` choca contra el índice a mitad de camino.

## 3. Un curso publicado tiene al menos una lección publicada

`canPublishCourse` (`policy/course_publication_policy.ts:7-8`). El estado E4 lo dice literal:
_"Un curso sin lecciones no se puede publicar"_.

Se comprueba **al publicar** (fase 14), no en la migración y no con un `CHECK`: es una regla
sobre dos tablas y sobre una transición de estado concreta. La migración no puede expresarla, y
un trigger la haría invisible desde el código que la necesita explicar al usuario.

Cuenta **lecciones publicadas**, no lecciones: un curso con seis lecciones todas en `DRAFT` no
tiene nada que enseñar. Ése es el `409 COURSE_HAS_NO_LESSONS` de la fase 14.

## 4. `data/courses.repository.ts` — todas las consultas del módulo

Ocho funciones, y **cada una con su `select` explícito**
(`data/courses.repository.ts:22-87`). Son cinco listas con nombre y existen para que exponer un
campo nuevo por una ruta pública sea un cambio deliberado en un archivo que se llama como lo que
hace.

| Lista                               | Columnas                                                                   | Quién la usa                                     |
| ----------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------ |
| `CATALOG_COURSE_SELECT` (`:22-30`)  | las siete de la tarjeta + `id`                                             | `GET /courses`                                   |
| `COURSE_DETAIL_SELECT` (`:32-41`)   | las de la ficha + `id`, `published_at` y perfil del docente                | `GET /courses/:slug` y la cabecera de la lección |
| `LESSON_SUMMARY_SELECT` (`:43-52`)  | las ocho del temario                                                       | `GET /courses/:slug` y el temario del `403`      |
| `LESSON_LOCKED_SELECT` (`:54-63`)   | las ocho de una lección **sin** contenido                                  | el `403 LESSON_LOCKED`                           |
| `LESSON_UNLOCKED_SELECT` (`:72-87`) | las anteriores + video, cuerpo, transcripción, `updated_at` y los recursos | la lección abierta                               |

**Las tres primeras no incluyen `article_body`, `transcript`, `video_provider` ni
`video_external_id`.** No es una omisión: es la frontera. Lo que no se lee no se puede filtrar por
accidente.

**Y la cuarta tampoco.** `LESSON_LOCKED_SELECT` y `LESSON_UNLOCKED_SELECT` son **la** decisión de
la fase 10: dos formas de la misma fila, cada una con su lista, en vez de una consulta completa a
la que se le borran campos antes de responder. Consecuencia concreta: en un `403`, las columnas de
contenido **no llegan a leerse de la base de datos**, porque `findPublishedLessonUnlocked`
(`:183-190`) solo se llama después de que `canViewLesson` haya devuelto `true`. El porqué largo
está en `../features/lessons/get_detail/docs/README.md` §2.

`LESSON_UNLOCKED_SELECT` incluye los recursos como relación anidada, **ordenados por
`position` en la consulta** (`:86`), no en memoria. El orden de los
adjuntos es contenido editorial y lo fija el admin en la fase 15.

El `id` sí se lee en las dos listas de curso, porque hace falta para cruzar el agregado de
lecciones y para la segunda consulta del temario. **No se expone**: el mapper no lo copia.

`publishedCoursesWhere` (`data/courses.repository.ts:94-106`) es el único sitio donde se escribe
`status: PUBLISHED` para los cursos, y lo comparten las cuatro consultas del catálogo. Las dos
funciones de facetas lo llaman **omitiendo a propósito su propia dimensión** (`:140`, `:152`); el
porqué está en `features/catalog/get_list/docs/README.md` §2.

## 5. `data/course_refs.repository.ts` — lo que este módulo le presta a los demás

Tres consultas más, en **un archivo aparte** (`data/course_refs.repository.ts`), con tres listas
propias: `COURSE_REF_SELECT` (`:10-14`), `LESSON_REF_SELECT` (`:16-22`) y
`LESSON_WITH_COURSE_SELECT` (`:24-31`).

| Función                                         | Qué devuelve                                                               | Quién la usa                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| `findPublishedCoursesByIds` (`:33-40`)          | `id`, `slug`, `title` de los cursos **publicados**                         | `GET /me/courses` (fase 11)                    |
| `findPublishedLessonRefsByCourseIds` (`:42-49`) | `id`, `course_id`, `slug`, `title`, `position` de las lecciones publicadas | el progreso, para contar y para "la siguiente" |
| `findLessonWithCourseById` (`:51-57`)           | la lección con su curso y **los dos estados**                              | la guardia de "¿se puede marcar?"              |

**Por qué un archivo aparte y no ocho funciones más en `courses.repository.ts`.** Porque no son
para las pantallas de este módulo: son la superficie que `modules/progress` —y mañana
`modules/comments`— tiene permitido usar. Tenerlas juntas y con nombre propio hace visible de un
vistazo qué le presta `courses` al resto del backend, y que ese préstamo son **referencias**
(id, slug, título, posición), nunca contenido: ninguna de las tres listas pide `article_body`,
`transcript` ni los datos del video.

**`findLessonWithCourseById` es la única consulta del módulo que NO filtra por estado**, y es
deliberado. Las demás ocultan lo no publicado en el `where`; ésta devuelve `status` de la lección
y del curso para que quien pregunta pueda distinguir _"no existe"_ (`404`) de _"ya no está
disponible"_ (`403 LESSON_LOCKED`). La decisión de qué hacer con esos dos estados **no** vive
aquí: vive en `modules/progress/shared/policy/lesson_marking.ts`, que compone `canViewLesson`.

## 6. `domain/course_mapper.ts` y `domain/lesson_mapper.ts` — la única puerta a la API pública

Tres funciones de curso (`domain/course_mapper.ts:12`, `:26`, `:43`) y cuatro de lección
(`domain/lesson_mapper.ts:18`, `:25`, `:36`, `:52`) que construyen el modelo **campo a
campo**. No hay `...spread` de la fila ni borrado de campos prohibidos: si el mapper no lo escribe,
no sale. Es lo que evita que el día que alguien amplíe un `select` el campo nuevo acabe en el
catálogo sin que nadie lo decida.

`toApiCourseDetail` serializa `published_at` a ISO 8601 (`:40`) y `toApiLessonUnlocked` hace lo
mismo con `updated_at` (`domain/lesson_mapper.ts:49`), igual que `toApiUser` con las fechas del
módulo de auth: el JSON de la API no lleva objetos `Date`.

`toApiLessonLocked` (`domain/lesson_mapper.ts:25-34`) y `toApiLessonUnlocked` (`:36-50`) son dos
funciones y no una con un `if`: la bloqueada **recibe un tipo que no tiene contenido**
(`domain/lesson.types.ts:3-12`), así que no existe la línea que podría filtrarlo. `video` se
construye aparte (`:13-16`) y sale `null` en cuanto falte el proveedor o el id — el caso de una
lección `ARTICLE`.

`domain/course_totals.ts` es el cálculo puro que alimenta al mapper. `toTotalDurationSeconds`
(`:12-13`) suma **segundos de video + minutos de lectura × 60**: la tarjeta del brief anuncia un
único tiempo para todas las lecciones del curso, y en _Fundamentos de legal tech_ dos de las seis
son artículos.

## 7. Quién usa esto hoy

Los dos endpoints públicos de las fases 09 y 10 usan `data/`, `domain/` y `policy/lesson_access.ts`
en cada petición. **Y desde la fase 11 hay un consumidor de fuera del módulo**:
`modules/progress` lee `data/course_refs.repository.ts`, `domain/course_refs.types.ts`,
`data/courses.repository.ts` (solo `findPublishedCourseBySlug`) y `policy/lesson_access.ts`. No
toca nada más, y `pnpm boundaries` lo hace cumplir sin baseline.

Las tres invariantes del modelo, en cambio, solo tienen un consumidor:

La semilla (`src/seed/index.ts:55-59`). No es un detalle: es el primer consumidor real y garantiza
que los seis cursos de `src/seed/seed_courses.ts` no puedan sembrar una lección con los dos tipos
llenos ni con el cuerpo vacío. Si un día alguien añade una lección de artículo sin cuerpo a la
semilla, `pnpm seed` falla con `SystemMessages.seed_lesson_content_invalid` en vez de meter la
fila mala.

## 8. `policy/lesson_access.ts` — quién puede ver una lección

```text
canViewLesson({ is_free_sample, has_session }) → boolean
```

Siete líneas (`policy/lesson_access.ts:1-7`) para la regla de negocio más importante de todo lo
público: _«cinco lecciones se abren al crear cuenta»_. Una muestra gratuita la ve cualquiera; el
resto, cualquiera con sesión.

**Recibe dos booleanos, no un usuario.** No puede consultar el rol, ni el progreso, ni
`email_verified_at`, y ésa es exactamente la garantía que se quiere: la verificación de correo
**no** bloquea el acceso a las lecciones (D-006 de `08_decisiones.md`), y una función que no
recibe el dato no puede empezar a usarlo un martes por la tarde.

**Un solo sitio.** La usan el `403 LESSON_LOCKED` de la fase 10
(`../features/lessons/get_detail/presentation/get_detail.service.ts:44-47`) y el `is_unlocked` del
temario público de la fase 09
(`../features/catalog/get_detail/presentation/get_detail.service.ts:32-35`), que antes escribía la
misma expresión a mano. La fase 11 la usa —**componiéndola, no copiándola**— dentro de
`modules/progress/shared/policy/lesson_marking.ts:10-16`, que le añade la única pregunta que aquí
sobraba porque la resolvía el `where`: _¿la lección y su curso siguen publicados?_ Si la regla
cambia —seis lecciones, o solo con correo verificado—, cambia en un archivo y los cuatro sitios
cambian con ella.

## 9. Docentes

`teachers.repository.ts` conserva perfiles de nombre, biografía y URL de foto. La tabla
`teachers` se relaciona con `courses.teacher_id`: un docente puede impartir varios cursos y la
asociación es opcional para mantener los cursos actuales. El mapper público construye solo los
tres campos del perfil; el id queda en la API administrativa. Los perfiles no son usuarios ni
cuentas de acceso. El guardado del curso y de su docente comparte una transacción y avanza la
marca de edición incluso cuando solo cambia el docente. Las pruebas PostgreSQL están en
`tests/integration/postgres/teachers_flow.test.ts`.

## Lectura de archivos con CloudFront

Los repositorios consultan también la clave interna de los archivos administrados. Los services
pasan un resolver a los mappers para generar URLs de lectura al responder; los DTOs conservan
sus campos URL y no incluyen claves. Las URLs persistidas son canónicas, sin caducidad.
Con S3, la lectura se firma; con local, se construye la URL local. Las filas sin clave conservan
su URL externa/legacy. Ver [STORAGE](../../../../../docs/STORAGE.md).
