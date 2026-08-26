# `modules/comments/shared` — el porqué

Lo que comparten los cuatro slices. La regla que lo ordena está en `02_reglas_backend.md` §9: aquí
llega lo que usan **varias actions del mismo módulo**, y lo que cruzaría a otro módulo se pide por
`modules/<m>/shared/`, nunca por su `data/`.

## 1. `data/comments.repository.ts` — tres `select` y ninguna regla

| `select` | Líneas | Para qué |
| --- | --- | --- |
| `COMMENT_AUTHOR_SELECT` | `:9-15` | las cinco columnas de `users` que pinta la tarjeta del autor |
| `COMMENT_SELECT` | `:17-23` | el comentario tal y como sale por la API, con su autor anidado |
| `COMMENT_REF_SELECT` | `:25-30` | lo mínimo para **decidir**: id, lección, padre y estado |

`COMMENT_AUTHOR_SELECT` **no pide `email`**, y esa es la razón por la que existe como constante
con nombre en vez de estar escrito dentro de la consulta: es la línea que alguien podría ampliar
sin darse cuenta, y así al menos está sola, con nombre y con un test que la mira
(`../test/comments_repository.test.ts`, *"el select del autor NO pide el correo"*).

`COMMENT_REF_SELECT` existe por lo contrario: `requireRootComment` solo necesita saber si el
comentario existe, si está visible y si tiene padre. Traer el cuerpo y el autor para tirarlos sería
leer de más en la ruta que más veces va a acabar en un `422`.

**Un hilo se lee en una sola consulta.** `findVisibleCommentsByLesson` (`:45-52`) trae raíces y
respuestas juntas, ordenadas por `created_at`, y el árbol lo arma el dominio. La alternativa
—una consulta para las raíces y otra por cada una— es el N+1 clásico, y en una lección con veinte
hilos son veintiuna consultas para pintar un bloque de la página.

**El índice que lo sostiene** es `@@index([lesson_id, status, created_at])`
(`prisma/schema/comments.prisma:21`): el `where` filtra por los dos primeros y el `orderBy` usa el
tercero, así que Postgres lee el índice y no ordena en memoria.

**`createCommentReport` (`:68-77`) no lee antes de escribir.** Usa
`createMany({ skipDuplicates: true })` —`INSERT … ON CONFLICT DO NOTHING`— y el índice único
`@@unique([comment_id, reported_by_user_id])` hace la idempotencia. Con un `select` + `if` +
`insert`, dos clics rápidos en el botón de reportar serían un `500` por violación de índice.
La función devuelve `void` **a propósito**: quien la llama no puede saber si insertó o no, y por
tanto no puede filtrarlo en la respuesta.

## 2. `domain/comment.types.ts` — las formas de la fila y las de la API, separadas

`CommentRecord` (`:11-17`) es lo que devuelve Prisma; `ApiComment` (`:33-39`) es lo que sale por el
cable. Que sean dos tipos y no uno es lo que hace que añadir una columna a la tabla **no** la
publique sola: para que salga, hay que tocar el mapper.

`ApiCommentThread` (`:41-43`) extiende `ApiComment` con `replies`. Las respuestas son `ApiComment`
a secas, sin `replies`: **el tipo es donde está escrito que solo hay un nivel**, así que anidar
más no es una decisión que se pueda tomar por accidente en un service.

`author` es **anulable** en los dos lados porque `comments.user_id` es `String?` con
`onDelete: SetNull` (`prisma/schema/comments.prisma:8,16`). Hoy la fase 13 borrará los
comentarios al dar de baja una cuenta; el `SetNull` es la red por si mañana se decide conservar el
hilo, y el frontend ya recibe un contrato que lo admite. Comprobado contra la base real
(`tests/integration/postgres/comments_flow.test.ts`, caso 17): borrar la cuenta deja los
comentarios con `author: null` y **sí** se lleva sus reportes, que van en `Cascade`.

## 3. `domain/comment_mapper.ts` — el autor reducido, en un solo sitio

`toApiCommentAuthor` (`:20-28`) es la única función del backend que construye la tarjeta del autor.
Los tres slices que devuelven comentarios pasan por ella, así que la regla de qué se publica de una
persona se cambia en un archivo.

`readAffiliation` (`:10-18`) da prioridad a `organization` sobre el texto de independiente. El
orden importa porque en la base hay usuarios con **las dos cosas** —organización rellena e
`is_independent: true`—: el registro no lo prohíbe. Enseñar la organización es lo específico; el
texto de independiente es el respaldo.

## 4. `domain/comment_thread.ts` — dos pasadas, ninguna búsqueda anidada

`buildThreads` (`:8-28`) recorre la lista dos veces: la primera crea los hilos raíz **en el orden
en que llegan**, la segunda cuelga cada respuesta de su padre por un `Map`. Es `O(n)`; un `find`
dentro del bucle sería `O(n²)` y en un hilo largo se nota.

**Una respuesta cuyo padre no está en la lista se descarta en silencio**, y es justo lo que hace
falta: la consulta solo trae `VISIBLE`, así que ocultar un comentario raíz oculta su hilo entero
sin tocar las respuestas. Si en vez de descartarse se promocionara a raíz, esconder una pregunta
dejaría a la vista una respuesta sin contexto. Fijado en `../test/comment_thread.test.ts` y
comprobado con `curl` sobre la base real.

## 5. `domain/commentable_lesson.ts` y `domain/comment_target.ts` — los dos guardianes

Los dos hacen lo mismo con distinto sujeto: una consulta, una comprobación y un `AppError` con el
código del contrato. Están en `domain/` y no en `policy/` porque **hacen I/O**: `policy/` en este
repo es lo puro (`modules/courses/shared/policy/lesson_access.ts:6-7`), y meter aquí una consulta
rompería esa lectura.

`requireRootComment` (`comment_target.ts:24-40`) distingue tres casos y cada uno tiene su respuesta:

| Caso | Respuesta | Por qué |
| --- | --- | --- |
| no existe | `404 NOT_FOUND` | nada que confirmar |
| existe pero está `HIDDEN` o `DELETED` | `404 NOT_FOUND` | para el público no existe; decir `403` confirmaría que hubo algo ahí |
| existe, visible, pero **tiene padre** | `422 VALIDATION_ERROR` | el hilo tiene un solo nivel y el cliente pidió algo que no cabe |

`requireComment` (`:14-22`) **no mira el estado**: reportar un comentario que un moderador ya
ocultó es inofensivo y evita explicarle al que reporta por qué su clic no hizo nada.

## 6. `deleteUserComments`, la fachada que usa `modules/user` (fase 13)

`data/comments.repository.ts:79-85` borra los reportes que hizo un usuario y después sus
comentarios. La llama la baja de cuenta (`DELETE /me`) pasándole **el cliente de su transacción**.

**Borra de verdad y no marca `DELETED`.** La pantalla 11 promete *"Se borran tu progreso y tus
comentarios"*, y `comments.user_id` es `SetNull` (`prisma/schema/comments.prisma:16`): dejar que
el motor hiciera su trabajo convertiría esa promesa en *"tus comentarios se quedan sin autor"*,
que es otra cosa. El estado `DELETED` del enum es del moderador de la fase 16 —un comentario
retirado que sigue existiendo—, y confundir los dos casos haría que la baja pareciera moderación.

**Se lleva por delante las respuestas ajenas a esos comentarios**, porque `parent_id` es `Cascade`
(`prisma/schema/comments.prisma:17`). Es la consecuencia de la decisión de la fase 12 y está
comprobada con `curl` en la fase 13. Lo que un vecino escribió por su cuenta no se toca.

El orden —reportes antes que comentarios— está fijado en `../test/comments_repository.test.ts`.
