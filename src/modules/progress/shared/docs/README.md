# `modules/progress/shared` — el porqué

Lo que comparten las cinco actions: **dos tablas, tres reglas puras y una guardia**. Aquí está la
parte del módulo que no se puede leer en un solo slice.

| Carpeta | Qué vive aquí |
| --- | --- |
| `policy/` | `isCourseCompleted` · `isEnrollmentFinished` · `resolveNextLesson` · `canMarkLesson` |
| `domain/` | tipos, mappers, `summarizeCourseProgress`, `groupLessonsByCourse`, `requireMarkableLesson` |
| `data/` | `progress.repository.ts`: las consultas del módulo, con `select` explícito, más las dos que publica para `modules/user` |

## 1. `isCourseCompleted` es una función pura de dos números

```ts
published_lesson_count > 0 && completed_lesson_count >= published_lesson_count
```

`policy/completion.ts:6-10`. Tres cosas que parecen detalles y no lo son:

1. **`> 0`**: un curso sin lecciones publicadas **no** está terminado. Sin esa mitad, un curso
   recién creado o uno al que se le despublicó todo aparecería como "terminado" para cualquiera
   que se hubiera inscrito, porque "todas sus lecciones" serían cero.
2. **`>=` y no `===`**: si el alumno completó seis lecciones y luego se despublica una, quedan
   cinco publicadas y seis completadas. El curso sigue terminado, que es lo que el alumno vivió.
3. **Cuenta lecciones publicadas, no las de la inscripción.** No hay ninguna columna
   `lesson_count` guardada: se cuenta en cada lectura. Guardarla obligaría a actualizarla en cada
   publicación de la fase 15 y a que nadie se olvidara nunca.

`isEnrollmentFinished` (`:12-16`) es la versión que usa la pantalla 10: exige **las dos** cosas —
la fecha sellada y el curso al día—. Es un predicado de tipo, así que después de pasarlo
TypeScript sabe que `completed_at` ya no es `null` y la lista de terminados no necesita ningún
`!` ni ningún cast.

## 2. El repositorio no lee para decidir: escribe con guarda

`data/progress.repository.ts`. Esta es **la** decisión del módulo, y está tomada contra el
endpoint que más se llama del producto (`PUT /lessons/:id/progress`, cada pocos segundos por
alumno).

`saveLessonProgress` (`:90-109`) hace tres sentencias y **ninguna es un `select` + `if` +
`insert`**:

| # | Sentencia | SQL real | Qué garantiza |
| --- | --- | --- | --- |
| 1 | `createMany({ skipDuplicates: true })` (`:95-98`) | `INSERT … ON CONFLICT DO NOTHING` | la fila existe, y dos peticiones a la vez **no** rompen el índice único |
| 2 | `updateMany` con `last_position_seconds: { lt: … }` (`:100-103`) | `UPDATE … WHERE last_position_seconds < $1` | el minuto **solo avanza** |
| 3 | `findUniqueOrThrow` (`:105-108`) | `SELECT` con `select` explícito | la respuesta es el estado real, no lo que el cliente mandó |

**Por qué no un `prisma.upsert` a secas.** Prisma no sabe expresar `GREATEST(actual, nuevo)` en la
rama `update`, así que un `upsert` con `update: { last_position_seconds }` escribiría el minuto
que llegue **aunque sea menor**: un evento de red que llega tarde y desordenado devolvería al
alumno al minuto 2. La regla "no se acepta un retroceso" tiene que estar en el `WHERE` de un
`UPDATE`, que es atómico, y no en un `if` del service, que no lo es.

**Por qué eso sigue siendo un upsert.** Las dos primeras sentencias son las dos mitades de
`INSERT … ON CONFLICT`: insertar si no está, corregir si está. Lo que la fase prohíbe —leer,
decidir en Node y escribir— es justo lo que aquí no ocurre: entre la lectura y la escritura de
otro proceso no hay ventana, porque no hay lectura previa.

**Comprobado contra PostgreSQL de verdad**, no contra un mock:
`tests/integration/postgres/progress_flow.test.ts` lanza dos guardados simultáneos del mismo
usuario sobre la misma lección y luego veinte a la vez; en los dos casos queda **una fila**, sin
`500`, y el minuto guardado es el mayor de los que llegaron. `shared/test/progress_repository.test.ts`
fija la forma de las tres sentencias: si alguien cambia el `lt` por un `lte` o quita el
`skipDuplicates`, el test se pone rojo.

`enrollInCourse` (`:66-76`) usa el mismo patrón por el mismo motivo: inscribirse dos veces es
**idempotente**, no un `409`.

## 3. `completeLesson` es una transacción, y la decisión vive dentro

`completeLesson` (`:111-169`) hace en **una** transacción lo que la fase pide en una transacción:

1. crea la fila de progreso si falta (`:119-122`);
2. sella `lesson_progress.completed_at` **solo si estaba a `null`** (`:124-127`) — volver a
   marcar no reescribe la fecha;
3. deja al alumno inscrito si no lo estaba (`:129-132`) y mueve `last_lesson_id` (`:134-137`);
4. **cuenta las publicadas completadas dentro de la transacción** (`:139-145`);
5. si `isCourseCompleted` dice que sí, sella `enrollments.completed_at` **con la guarda
   `completed_at: null`** (`:147-157`).

El paso 4 es la razón de que la política pura se llame **desde el repositorio** y no desde el
service: el número que necesita solo existe dentro de la transacción, y sacarlo fuera abriría la
ventana en la que dos marcados simultáneos deciden los dos que "todavía falta una". Es un
apartamiento consciente de "el repositorio no lleva reglas": la regla sigue siendo **una sola
función pura en `policy/`**, y lo que hay aquí es la llamada, no una segunda copia del criterio.

La guarda del paso 5 es la que cumple *"no se reescribe el pasado"*: si la fecha ya estaba
puesta, el `UPDATE` no encuentra fila y no hace nada.

## 4. `requireMarkableLesson`: dónde termina la fase 10 y empieza la 11

`domain/markable_lesson.ts:21-47` es la guardia que comparten las tres actions de
`lesson_progress`. Traduce dos preguntas a dos estados HTTP:

| Caso | Respuesta |
| --- | --- |
| la lección no existe | `404 NOT_FOUND` (`:27-31`) |
| existe pero está en borrador, o su curso no está publicado | `403 LESSON_LOCKED` (`:40-44`) |
| existe y se puede ver | sigue |

**Por qué hace falta una regla nueva y no basta `canViewLesson`.** La fase 10 nunca preguntaba
"¿está publicada?" porque lo filtraba en el `where` de sus consultas: una lección en borrador
sencillamente no se leía. Aquí la lección llega **por id**, desde el reproductor, y hay que poder
distinguir "no existe" de "ya no está disponible". Por eso
`../../courses/shared/data/course_refs.repository.ts:51-57` la lee **sin filtrar por estado** y la decisión la toma
`canMarkLesson` (`policy/lesson_marking.ts:10-16`), que **compone** `canViewLesson` en vez de
copiarla:

```ts
is_lesson_published && is_course_published && canViewLesson({ is_free_sample, has_session })
```

Así, el día que la fase 10 cambie qué significa "poder ver una lección", esto cambia con ella.

**El texto del `403` no es el de la fase 10, el código sí.** `meta.code` sigue siendo
`LESSON_LOCKED` (`src/constants/error_codes.ts:17`) —el frontend ramifica por el código—, pero la
descripción es *"Esta lección ya no está disponible"*
(`src/constants/messages/progress.ts:9`) y no *"Crea tu cuenta gratis para ver esta lección"*:
estas tres rutas exigen Bearer, así que el motivo nunca puede ser la falta de cuenta.

## 5. `summarizeCourseProgress` calcula lo que la pantalla 10 pinta

`domain/course_progress.ts:11-27` recibe las lecciones **publicadas ahora** y los ids completados,
y devuelve los cuatro datos de la tarjeta: `completed_lessons`, `lesson_count`, `next_lesson` y
`is_completed`. Dos detalles:

- **`completed_lessons` cuenta la intersección**, no la longitud de la lista de completadas: una
  lección completada y luego despublicada no infla el "2 de 6".
- **`next_lesson` es la primera NO completada** (`policy/next_lesson.ts:3-7`), no la siguiente en
  orden. Si el alumno vio la 1 y la 3, la siguiente es la **2**. Es lo que pinta *"Sigues en: …"*
  de la pantalla 10, y hay test.

`groupLessonsByCourse` (`:29-42`) existe para que `GET /me/courses` haga **una** consulta de
lecciones para todos los cursos del alumno en vez de una por curso.

## 6. Los mappers no dejan salir ids internos

`domain/progress_mapper.ts` construye las formas de la API campo a campo. Ni `course.id`, ni
`enrollment.id`, ni el `id` de la siguiente lección salen nunca: el curso viaja por `slug` y la
lección siguiente por `slug` y `title`, que es lo que necesita el enlace. Hay un test que busca
las cadenas de los ids en el JSON serializado (`shared/test/progress_mapper.test.ts`).

La excepción deliberada es `lesson_id` en `PUT /lessons/:id/progress` y en las dos de
`complete`: la ruta ya va por id —la manda el reproductor, no un enlace del catálogo— y
devolverlo es lo que permite al cliente casar la respuesta con la petición.

## 8. Lo que este módulo publica para `modules/user` (fase 13)

Dos funciones al final de `data/progress.repository.ts`, y las dos existen porque la alternativa
era que otro módulo leyera `enrollments` por su cuenta:

| Función | Líneas | Quién la llama |
| --- | --- | --- |
| `countCompletedEnrollments` | `:194-195` | `GET /me/summary` — el *"1 curso terminado"* del pie de la pantalla 11 |
| `deleteUserProgress` | `:197-203` | `DELETE /me` — borra `lesson_progress` y después `enrollments` |

`deleteUserProgress` acepta un `Prisma.TransactionClient` como segundo parámetro **y quien la
llama siempre se lo pasa**: la baja de cuenta es una sola transacción, y una función que usara el
cliente global escribiría fuera de ella. El orden interno —avance antes que inscripciones— también
está fijado en `../test/progress_repository.test.ts`.

Estas dos son ahora la única forma sancionada de tocar estas tablas desde fuera del módulo, junto
con las que ya usaba `modules/comments`. `pnpm boundaries` verifica que nadie se salte la fachada.
