# `modules/comments` — el porqué

El bloque de preguntas de la pantalla 08 y su estado vacío (E5): cualquiera lee el hilo, quien
tiene el correo verificado escribe, el equipo responde con insignia y cualquiera con cuenta
reporta lo que no debería estar ahí.

```text
src/routes/index.ts:15       routes.use(ApiPrefix, commentsRouter)
index.ts:9                   commentsRouter.use(LessonsRoutePrefix, lessonThreadRouter)
index.ts:10                  commentsRouter.use(CommentsRoutePrefix, commentThreadRouter)
index.ts:11                  commentsRouter.use(CommentsRoutePrefix, commentReportRouter)
```

| Método | Ruta | Auth | Slice |
| --- | --- | --- | --- |
| `GET` | `/api/v1/lessons/:lesson_id/comments` | **pública** | `thread/get_list` |
| `POST` | `/api/v1/lessons/:lesson_id/comments` | Bearer + correo verificado + 5/h | `thread/create` |
| `POST` | `/api/v1/comments/:id/replies` | Bearer + correo verificado + 5/h | `thread/reply` |
| `POST` | `/api/v1/comments/:id/report` | Bearer | `report/create` |

## 1. Dos prefijos, un módulo, y por qué no chocan con `modules/progress`

Un comentario cuelga de una lección, pero una respuesta y un reporte cuelgan de **otro
comentario**, y ahí la lección ya no pinta nada: la respuesta hereda la lección de su padre
(`features/thread/reply/presentation/reply.service.ts:11-16`), no la manda el cliente. Por eso el
módulo se monta con `ApiPrefix` a secas y reparte sus rutas entre `LessonsRoutePrefix` y
`CommentsRoutePrefix` (`index.ts:9-11`), el mismo patrón que estrenó `modules/progress`
(`src/modules/progress/index.ts:10-12`).

**Comparte `/lessons/:lesson_id/…` con `modules/progress` y no hay colisión.** Express prueba los
routers en orden: `progressRouter` va antes (`src/routes/index.ts:14`) y solo declara
`/progress` y `/complete`; ninguno casa con `/comments`, así que la petición sigue hasta
`commentsRouter`. Comprobado con `curl` contra el servidor real, no solo razonado.

## 2. La frontera con `modules/courses`

Este módulo necesita responder una sola pregunta sobre una lección: *¿existe, publicada, dentro de
un curso publicado?* La pide por la fachada que creó la fase 11 —`findLessonWithCourseById`
(`src/modules/courses/shared/data/course_refs.repository.ts:51-57`)— y **no** importa el `data/`
privado de nadie, que es lo que `pnpm boundaries` verifica sin baseline.

La respuesta se decide en `shared/domain/commentable_lesson.ts:12-26`, un solo sitio para los tres
slices que la necesitan. **No reutiliza `canViewLesson`** (`src/modules/courses/shared/policy/lesson_access.ts:6-7`) y no es
un olvido: esa regla contesta *"¿puedo ver el contenido?"* y aquí la pregunta es otra. Una lección
bloqueada —la que pide crear cuenta para ver el vídeo— **sí** enseña sus comentarios: el brief
pinta el bloque de preguntas en la pantalla 08 y el listado es público. Lo que no existe para el
público es una lección en borrador o de un curso archivado, y eso responde `404`, nunca `403`,
igual que en las fases 09 y 10: un `403` sobre un borrador confirma que ese id existe.

## 3. El correo del autor no sale nunca, y se corta en la consulta

`COMMENT_AUTHOR_SELECT` (`shared/data/comments.repository.ts:9-15`) pide cinco columnas de
`users` y `email` no está entre ellas. La fuga no se evita borrando el campo al mapear —eso lo
rompe el primer `select` que alguien amplíe—, se evita **no leyéndolo**: si la columna no llega
del motor, no hay forma de que se serialice.

Encima de eso hay dos redes más: el mapper construye el autor campo a campo
(`shared/domain/comment_mapper.ts:20-28`), y hay tests que buscan la cadena `@` **sobre el JSON
serializado**, no sobre las claves del objeto —`shared/test/comment_mapper.test.ts`,
`features/thread/get_list/test/get_list.controller.test.ts` y el `curl` real de
`tests/integration/postgres/comments_flow.test.ts` (caso 7)—. Una clave llamada `contacto` con un
correo dentro pasaría una comprobación de claves y no pasa ésta.

## 4. `is_team` y `affiliation` se calculan al mapear, no se guardan

`is_team` es `role === 'ADMIN'` leído **en el momento de responder**
(`shared/domain/comment_mapper.ts:27`). Guardarlo en la fila sería más rápido y estaría mal: quien
deja el equipo seguiría llevando la insignia *"Equipo Arxatec"* en todo lo que escribió, y la
pantalla 08 usa esa insignia para decir *"esto lo contesta el producto"*. Hay un test que baja el
rol de un `ADMIN` en la base y comprueba que la misma respuesta ya publicada cambia
(`tests/integration/postgres/comments_flow.test.ts`, caso 6).

`affiliation` sale de `organization` y, si no hay, del texto de independiente
(`CommentMessages.author.independent`, `shared/domain/comment_mapper.ts:10-18`). Una organización
en blanco o con solo espacios cuenta como ausente: en la semilla hay usuarios con `organization`
vacío en vez de `null`, y sin el `trim()` la tarjeta pintaría una afiliación vacía.

## 5. Qué comparte el módulo y qué no

| Pieza | Dónde | Quién la usa |
| --- | --- | --- |
| lectura y escritura en Prisma | `shared/data/comments.repository.ts` | los cuatro slices |
| formas de la API y de la fila | `shared/domain/comment.types.ts` | todos |
| el autor reducido, en un solo sitio | `shared/domain/comment_mapper.ts:20-36` | listar, crear y responder |
| agrupar el hilo de un nivel | `shared/domain/comment_thread.ts:8-28` | solo listar |
| ¿la lección admite comentarios? | `shared/domain/commentable_lesson.ts:12-26` | listar y crear |
| ¿el comentario existe / es raíz? | `shared/domain/comment_target.ts:14-40` | responder y reportar |

**No hay `shared/policy/`** y es a propósito: aquí no hay ninguna decisión pura que no sea un
`if` de dos líneas dentro del guardián que ya hace la consulta. Inventar una política para
envolver `status === VISIBLE` sería ceremonia.

## 6. Lo que este módulo deja abierto

- **No hay paginación.** Un hilo de lección con cien comentarios se sirve entero. El punto de
  corte está en `features/thread/get_list/docs/README.md` §4.
- **No se puede editar ni borrar un comentario propio.** El brief no lo pide; la fase 16 traerá
  el borrado del moderador, y el enum `comment_status` ya tiene `HIDDEN` y `DELETED` esperándolo.
- **`updated_at` existe en la tabla y no se expone.** Hoy nada lo mueve; el día que haya edición,
  la pantalla querrá pintarlo.
- **Reportar no tiene rate limit.** El índice único ya impide que una persona infle el contador
  de un comentario; lo que no impide es reportar cien comentarios distintos. La fase 16, que es
  la que lee esos contadores, es la que sabrá si duele.
