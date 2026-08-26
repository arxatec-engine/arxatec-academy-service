# `modules/progress` — el porqué

Lo que convierte un catálogo en una escuela: **empezar un curso significa algo, marcar una
lección se recuerda, y "Mis cursos" sabe por dónde ibas**. Pantalla 10, estado E3 (sin nada
empezado) y la promesa de E7 (*"vuelves a esta misma lección, en el minuto donde la dejaste"*).

```text
src/routes/index.ts:14       routes.use(ApiPrefix, progressRouter)
index.ts:10                  progressRouter.use(CoursesRoutePrefix, enrollmentRouter)
index.ts:11                  progressRouter.use(LessonsRoutePrefix, lessonProgressRouter)
index.ts:12                  progressRouter.use(MeRoutePrefix, myCoursesRouter)
```

| Método | Ruta | Auth | Feature |
| --- | --- | --- | --- |
| `POST` | `/api/v1/courses/:slug/enroll` | Bearer | `enrollment/create` |
| `PUT` | `/api/v1/lessons/:lesson_id/progress` | Bearer + 1/s | `lesson_progress/update` |
| `POST` | `/api/v1/lessons/:lesson_id/complete` | Bearer | `lesson_progress/complete` |
| `DELETE` | `/api/v1/lessons/:lesson_id/complete` | Bearer | `lesson_progress/uncomplete` |
| `GET` | `/api/v1/me/courses` | Bearer | `my_courses/get_list` |

## 1. Por qué el módulo se monta en `ApiPrefix` y no en un prefijo propio

Sus cinco rutas cuelgan de **tres** prefijos distintos —`/courses`, `/lessons` y `/me`— porque
están escritas desde el punto de vista del alumno, no del módulo: "empezar **este curso**",
"guardar **esta lección**", "**mis** cursos". Un `/progress/...` sería un prefijo que nombra la
tabla, no la acción.

Por eso `src/routes/index.ts:14` lo monta con `ApiPrefix` a secas y el prefijo de cada grupo se
pone en `index.ts:10-12`, una sola vez, con las constantes de `src/constants/endpoints.ts:23`,
`:37` y `:39`. Ningún `*.routes.ts` repite el prefijo.

**Las rutas no chocan con las de `modules/courses`.** `coursesRouter` va montado antes
(`src/routes/index.ts:13`) y sus rutas tienen uno (`/:slug`) o tres segmentos
(`/:course_slug/lessons/:lesson_slug`); `/:slug/enroll` tiene dos y además es `POST`. Express
prueba el primero, no encuentra ruta y sigue. Comprobado con `curl` contra el servidor real.

## 2. Qué le pide este módulo a `modules/courses`, y por dónde

`modules/progress` **no importa el `data/` privado de `modules/courses`**: la superficie
sancionada es `modules/courses/shared/`, y `pnpm boundaries` lo hace cumplir sin baseline. De ahí
salen tres cosas y ninguna más:

| Qué | De dónde |
| --- | --- |
| el curso publicado por slug | `../courses/shared/data/courses.repository.ts:159-163` |
| las lecciones publicadas de un curso (id, slug, título, posición) | `../courses/shared/data/course_refs.repository.ts:42-49` |
| la lección con su curso y **los dos estados**, para decidir si se puede marcar | `../courses/shared/data/course_refs.repository.ts:51-57` |

Y una regla: `canViewLesson` (`../courses/shared/policy/lesson_access.ts:6-7`), que **no se
duplica** — se compone dentro de `shared/policy/lesson_marking.ts:10-16`.

Este módulo escribe **solo** en sus dos tablas (`enrollments` y `lesson_progress`). No toca
`courses` ni `lessons` ni siquiera para leer un contador: el contador se calcula.

## 3. Las dos tablas y por qué son como son

`prisma/schema/progress.prisma`. Dos decisiones que se ven en el esquema:

- **`enrollments.completed_at` es una fecha anulable, no un booleano.** La pantalla 10 dice
  *"terminaste el 3 jul"*: un booleano tira el dato y no se recupera.
- **`enrollments.last_lesson_id` es `SetNull`, no `Cascade`.** Si se borra una lección, el alumno
  pierde el marcador, no la matrícula. `Cascade` ahí borraría inscripciones enteras por editar el
  temario.

Los dos índices únicos —`@@unique([user_id, course_id])` y `@@unique([user_id, lesson_id])`— son
la garantía de "una fila por alumno y curso / por alumno y lección". El módulo está escrito para
**apoyarse** en ellos en vez de esquivarlos: ver `shared/docs/README.md` §2.

## 4. El reparto entre `policy/`, `domain/` y `data/`

- `shared/policy/` — las tres reglas puras: *¿está terminado el curso?* (`completion.ts:6-10`),
  *¿cuál es la siguiente?* (`next_lesson.ts:3-7`) y *¿se puede marcar?*
  (`lesson_marking.ts:10-16`). Sin Prisma, sin Express, sin `AppError`.
- `shared/domain/` — los tipos, los mappers a la forma de la API y las dos piezas que combinan
  reglas: `summarizeCourseProgress` (`course_progress.ts:11-27`) y `requireMarkableLesson`
  (`markable_lesson.ts:21-47`).
- `shared/data/` — Prisma y nada más, con `select` explícito en cada consulta.

## 5. Lo que este módulo NO hace

- **No sirve contenido.** Nunca devuelve `article_body`, `transcript` ni el id del video: eso es
  `modules/courses/features/lessons`. Sus `select` ni siquiera piden esas columnas.
- **No exige el correo verificado** (D-006). Verificar solo hace falta para comentar (fase 12).
  Hay un test que lo fija en `features/enrollment/create/test/create.controller.test.ts`.
- **No decide quién puede ver una lección**: eso lo decide `canViewLesson`, de la fase 10. Aquí
  solo se le añade la pregunta que la fase 10 resolvía en el `where` de sus consultas: *¿sigue
  publicada?* (`shared/docs/README.md` §4).
- **No borra el pasado.** Una fecha de fin ya sellada no se reescribe ni se borra por un cambio
  editorial; ver `features/lesson_progress/complete/docs/README.md` §3.
