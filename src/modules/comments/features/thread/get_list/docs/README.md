# `GET /lessons/:lesson_id/comments` — el porqué

El bloque de preguntas de la pantalla 08 y su estado vacío, E5.

## 1. El recorrido

```text
GET /api/v1/lessons/:lesson_id/comments        (sin auth, ni siquiera opcional)
  → getCommentsController      parse → service → 200
  → getCommentsSchema          lesson_id (de la ruta)
  → getCommentsService         ¿lección publicada? → comentarios VISIBLE → hilos
  → comments.repository        una consulta, orden ascendente
  → 200 { comments: [ { …, author, replies: [ … ] } ] }
```

| Paso | Archivo |
| --- | --- |
| cadena de la ruta | `presentation/get_list.routes.ts:6-8` |
| validación → service → respuesta | `presentation/get_list.controller.ts:10-24` |
| reglas | `presentation/get_list.service.ts:7-14` |
| lectura | `../../../shared/data/comments.repository.ts:45-52` |
| árbol de un nivel | `../../../shared/domain/comment_thread.ts:8-28` |

## 2. Por qué no lleva ni `optionalAuthenticate`

Es la única ruta del backend, junto a las del catálogo, que **no** mira si hay sesión — y a
diferencia de `GET /courses/:slug`, aquí ni siquiera cambia algo cuando la hay: los comentarios
son los mismos para todo el mundo. Montar `optionalAuthenticate` costaría una consulta de sesión
por petición para no usar el resultado.

La consecuencia está asumida: **el listado no dice cuáles son tuyos ni cuáles ya reportaste**. Lo
segundo es a propósito (ver `../../../report/create/docs/README.md` §3); lo primero, cuando alguna
pantalla lo necesite, se resuelve añadiendo el middleware opcional y un booleano al mapper, no
cambiando la forma de la respuesta.

## 3. Una lección bloqueada sí enseña sus comentarios; una en borrador no existe

El guardián es `requireCommentableLesson`
(`../../../shared/domain/commentable_lesson.ts:12-26`), que exige **lección publicada dentro de
curso publicado** y responde `404` si falla. No usa `canViewLesson`: el muro de la fase 10 tapa el
vídeo y el artículo, no la conversación. Que un visitante sin cuenta lea las preguntas de una
lección que aún no puede ver es parte de lo que le convence de crear la cuenta.

El `404` es el mismo texto y el mismo código que da la lección en la fase 10
(`CourseMessages.lesson.not_found`), porque desde fuera es el mismo hecho: ese id no corresponde a
nada público.

## 4. Lista vacía es `200`, y no hay paginación

E5 es una pantalla, no un error: una lección sin preguntas responde `200` con `comments: []` y el
frontend pinta *"Sé el primero en preguntar"*. Devolver `404` obligaría al frontend a tratar el
caso más normal del mundo —una lección recién publicada— como un fallo.

**Tampoco hay paginación, todavía.** El hilo de una lección se sirve entero. Con el catálogo
actual (31 lecciones) y un producto que aún no ha abierto, el corte natural llegará cuando un hilo
pase de unas decenas de comentarios; el sitio donde entrará es el `orderBy` del repositorio, y la
forma será la misma que use el catálogo cuando la tenga. Lo que **no** puede pasar es que se
añada devolviendo solo raíces: las respuestas viajan en el mismo lote precisamente para que el
bloque se pinte con una petición.

## 5. Los tests

- `test/get_list.service.test.ts` — el hilo con su respuesta y el autor reducido, la lista vacía,
  el id que sale del guardián (no el de la petición), el `404` que corta antes de leer comentarios
  y **el JSON sin arrobas**.
- `test/get_list.controller.test.ts` — el sobre completo **sin token**, el `404` propagado, y la
  comprobación de la fuga sobre `JSON.stringify(response.body)`: contiene el nombre del autor y
  **ni una `@`**.
- `tests/integration/postgres/comments_flow.test.ts` — los mismos casos contra PostgreSQL real,
  más los `HIDDEN`/`DELETED` que desaparecen con su hilo entero (caso 12).
