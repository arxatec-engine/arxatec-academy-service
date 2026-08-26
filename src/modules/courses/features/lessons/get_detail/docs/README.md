# `GET /courses/:course_slug/lessons/:lesson_slug` — el porqué

La pantalla de lección: 03 (muestra gratuita), 08 (video), 09 (artículo) y **E6** (el video que no
carga). Es el único endpoint público que entrega **contenido**, y por eso es el único que decide
quién puede verlo.

## 1. El recorrido

```text
GET /api/v1/courses/:course_slug/lessons/:lesson_slug   (Bearer opcional)
  → optionalAuthenticate      Bearer válido → req.user; roto, caducado o ausente → anónimo
  → getDetailController       sesión → parse → service → 200 o 403, según la forma que vuelva
  → getDetailSchema.parse     los dos slugs de la ruta + has_session (booleano, no el usuario)
  → getDetailService          curso publicado → temario → ¿canViewLesson? → una forma o la otra
  → courses.repository        shared/data: curso, temario y UNA de las dos formas de la lección
  → toApiLessonUnlocked  /  toApiLessonLocked
  → 200 { lesson, course, navigation }   ·   403 { lesson, course, lessons } + LESSON_LOCKED
```

| Paso | Archivo |
| --- | --- |
| cadena de la ruta | `presentation/get_detail.routes.ts:9` |
| sesión → validación → service → estado HTTP | `presentation/get_detail.controller.ts:12-42` |
| reglas de negocio | `presentation/get_detail.service.ts:27-88` |
| la regla de acceso, pura | `src/modules/courses/shared/policy/lesson_access.ts:6-7` |
| los dos `select` | `src/modules/courses/shared/data/courses.repository.ts:54-87` |
| los dos mappers | `src/modules/courses/shared/domain/lesson_mapper.ts:25`, `:36` |

## 2. Dos formas, dos `select`, dos mappers — y ni un borrado de campos

Es **la** decisión de la fase y la razón de que este slice no se parezca a los de la fase 09.

La forma tentadora de escribir esto es una sola: traer la lección entera, construir la respuesta y,
si el visitante no tiene acceso, **borrar** `video`, `article_body` y `transcript` antes de
responder. Funciona el primer día. Falla el día que alguien añade una columna al `select` —un
`speaker_notes`, un `answer_key`— y no se acuerda de añadirla a la lista de borrado: la fuga es
silenciosa, no la ve ningún tipo, no la ve ningún test que no la esté buscando, y va a producción.

Aquí se hace al revés. Hay **dos tipos** (`LessonLockedRecord` y `LessonUnlockedRecord`,
`src/modules/courses/shared/domain/lesson.types.ts:3-28`), **dos `select`**
(`LESSON_LOCKED_SELECT`, `src/modules/courses/shared/data/courses.repository.ts:54-63`, y `LESSON_UNLOCKED_SELECT`, `:72-87`) y
**dos mappers** que construyen el objeto campo a campo (`lesson_mapper.ts:25-34` y `:36-50`).
Exponer algo nuevo en la respuesta bloqueada exige escribirlo a propósito **en tres archivos**.

Y hay una garantía más fuerte que la de la fase 09: en una respuesta `403`, las columnas de
contenido **no se leen de la base de datos**. El service llama a `findPublishedLessonLocked` **o** a
`findPublishedLessonUnlocked`, nunca a las dos (`presentation/get_detail.service.ts:50`, `:74`), y
la segunda solo se ejecuta después de que `canViewLesson` haya devuelto `true` (`:44-49`). Lo que
no se lee no se puede filtrar ni por un `console.log`, ni por un log de errores, ni por un campo
que alguien añada al mapper por error.

**El precio, dicho en claro.** La lección bloqueada ya venía dentro del temario que el service
trajo para calcular `navigation`; volver a leerla con su propio `select` es **una consulta más**.
Se paga a propósito: reconstruir la forma bloqueada desde `LESSON_SUMMARY_SELECT` —el `select` del
catálogo— ataría el contrato del `403` de esta ruta a una lista que se mantiene para otra pantalla,
y el día que la fase 15 amplíe el temario, esta respuesta cambiaría sin que nadie lo pidiera. Son
tres consultas indexadas por petición, en los dos caminos.

**Comprobado, no supuesto.** `test/get_detail.controller.test.ts` busca **las cadenas** en
`JSON.stringify(response.body)` del `403` —el cuerpo del artículo, el texto de la transcripción y
el `external_id` del video—, no las claves del objeto: una clave se puede renombrar, el valor
filtrado no engaña a nadie.

## 3. La verificación de correo no pinta nada aquí

Un usuario con sesión y **sin el correo verificado** ve la lección entera. Es **D-006** de
`08_decisiones.md`: verificar solo hace falta para comentar (fase 12). En esta ruta **no hay
`requireVerifiedEmail`**, y no es un olvido.

Es la clase de regla que se rompe sin que nada se queje: añadir el middleware compila, pasa el
lint, pasa el typecheck y mata la conversión del producto en silencio. Por eso hay un test
explícito con una sesión cuyo `email_verified_at` es `null` que exige `200` y el contenido completo
(`test/get_detail.controller.test.ts`, *«un usuario SIN correo verificado ve la lección entera»*).

`canViewLesson` (`src/modules/courses/shared/policy/lesson_access.ts:6-7`) no recibe el usuario:
recibe **dos booleanos**. No puede consultar la verificación aunque alguien quisiera.

## 4. `navigation` se calcula entre lecciones publicadas

Las pantallas 08 y 09 rematan con *«Sigue con la lección 2»*. `navigation` es ese enlace, y su
vecino no es *la posición ± 1*: es **la lección contigua en la lista de publicadas**.

`findPublishedLessonsByCourseId` ya filtra por `status: PUBLISHED`
(`src/modules/courses/shared/data/courses.repository.ts:165-172`), así que una lección en borrador
**no está en la lista** y el hueco no existe: si la 4 está en borrador, la siguiente de la 3 es la
5. `resolveLessonNavigation` (`domain/lesson_navigation.ts:16-22`) se limita a mirar el índice
anterior y el siguiente, y devuelve `null` en los bordes.

Buscar literalmente `position - 1` y `position + 1` daría `null` en ese hueco y dejaría al alumno
sin salida a mitad del curso. Hay un test con las posiciones `1, 2, 3, 5` que lo fija, y una
comprobación hecha contra la base real despublicando la lección 4.

Del vecino salen **solo `slug` y `title`** (`domain/lesson_navigation.ts:11-14`). La navegación es
un enlace, no una segunda puerta al contenido.

## 5. La transcripción viaja con la lección abierta

E6 es *«el video no carga»*, y ofrece dos salidas: *«Abrir en Vimeo»* y *«Leer la transcripción»*.
Las dos tienen que estar **en la misma respuesta**, porque si el reproductor falla no va a haber
una segunda petición que salga bien.

Por eso el backend no sirve el video: lo **referencia**. `video` es
`{ provider, external_id }` (`lesson_mapper.ts:13-16`) y el reproductor es cosa del frontend. Y por
eso `transcript` viaja siempre en la forma abierta, aunque ninguna pantalla «feliz» lo pinte.

`video` es `null` cuando falta el proveedor o el id —el caso normal de una lección `ARTICLE`—, y no
existe una forma intermedia: la política de la fase 08 garantiza que una lección es de video **o**
de artículo, nunca las dos (`src/modules/courses/shared/docs/README.md` §1).

## 6. Lo que no existe responde `404`, nunca `403`

| Caso | Respuesta |
| --- | --- |
| curso en borrador, archivado o inexistente | `404 NOT_FOUND` · «No encontramos ese curso» (`get_detail.service.ts:30-34`) |
| lección en borrador o inexistente | `404 NOT_FOUND` · «No encontramos esa lección» (`get_detail.service.ts:39-41`) |
| lección publicada, sin acceso | `403 LESSON_LOCKED` |

Igual que en la fase 09: un `403` sobre un borrador confirmaría que ese slug existe y está por
publicarse, y el slug se elige antes de anunciar el curso. El filtro va en el `where` de las
consultas, no en un `if` posterior, así que un borrador **no se oculta: no se lee**.

Las dos consultas de forma pueden devolver `null` aunque el temario dijera que la lección estaba
ahí —dos consultas, sin transacción, y entre medias cabe un `UPDATE` de la fase 15—. Ese caso
también es `404` (`get_detail.service.ts:52-54`, `:76-78`): media lección no se entrega.

## 7. Por qué el `403` lleva `data`, y por qué no es un `AppError`

El muro de la pantalla 03 necesita pintar título, descripción, tipo, duración **y el temario del
curso** sin pedir nada más: si hiciera falta una segunda petición, el visitante vería un salto.

`AppError` solo transporta `message`, `statusCode` y `meta` (`src/utils/errors.ts:9-20`): no tiene
sitio para un cuerpo. Ensancharlo para este caso metería un campo `data` en la superficie de error
de **todo** el backend por una pantalla.

La salida es que **el `403` no es un error de excepción, es un resultado**. El service devuelve una
unión discriminada (`domain/get_detail.types.ts:30-31`) y el controller traduce cada rama a su
estado HTTP (`presentation/get_detail.controller.ts:21-42`). Eso deja el controller **sin
`try/catch`** —los `404` siguen subiendo como `AppError` al manejador global— y deja la decisión
de negocio donde debe estar: elegir entre `200` y `403` es traducir transporte, que es justo el
trabajo del controller; **decidir si se puede ver es `canViewLesson`**, y vive en `policy/`.

El sobre es el de siempre: `meta.code = LESSON_LOCKED` (`src/constants/error_codes.ts:17`) es lo
que lee el frontend, no el texto de `description`.

## 8. El controller pasa un booleano, no el usuario

`has_session: authenticated_user !== null` (`presentation/get_detail.controller.ts:17`). El service
no necesita saber quién es —no hay progreso ni inscripción en esta respuesta, eso es la fase 11—, y
un payload que no lleva el id del usuario es un payload que no puede filtrarlo por error.

Cuando la fase 11 añada «lección completada», el payload crecerá con el `user_id`; hasta entonces,
no.

## 9. Los tests

- `test/get_detail.service.test.ts` — los cuatro cruces de la tabla de acceso, los dos `404`, que
  una lección bloqueada **no pide** la forma abierta al repositorio, el artículo con `video: null`,
  el orden de los recursos, el hueco de la lección en borrador y los dos bordes de `navigation`.
- `test/get_detail.controller.test.ts` — el router real con Supertest y `optionalAuthenticate` **de
  verdad**, con la sesión mockeada: muestra sin token (`200`), lección normal sin token (`403`),
  las dos con token (`200`), **el usuario sin verificar** (`200`, D-006), sesión revocada (`403`) y
  Bearer con basura (`403` sin consultar la sesión). En el `403`, la búsqueda de cadenas sobre el
  JSON serializado.
- `test/lesson_navigation.test.ts` — la función pura: medio, primera, última, curso de una sola
  lección, el salto del borrador y un índice fuera de rango.
- La regla de acceso y los dos mappers tienen sus propios tests en
  `src/modules/courses/shared/test/`, porque son del módulo, no de este slice.
