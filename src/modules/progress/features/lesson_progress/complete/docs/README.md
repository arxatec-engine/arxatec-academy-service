# `POST /lessons/:lesson_id/complete` — el porqué

"Marcar como completada" (pantallas 08 y 09). Es la action que decide cuándo un curso pasa a
"Terminado" en la pantalla 10, y **la regla más fácil de implementar mal de toda la fase**.

## 1. El recorrido

```text
POST /api/v1/lessons/:lesson_id/complete   (Bearer obligatorio)
  → authenticateTokenJwt        sin sesión → 401
  → completeLessonController    usuario → parse → service → 200
  → completeLessonService       guardia de acceso → publicadas de AHORA → transacción → contadores
  → progress.repository         una transacción: lección, inscripción, marcador y quizá la fecha
  → 200 { mark: { lesson_id, completed_at, enrollment } }
```

| Paso | Archivo |
| --- | --- |
| cadena de la ruta | `presentation/complete.routes.ts:9-13` |
| usuario → validación → service → respuesta | `presentation/complete.controller.ts:11-28` |
| reglas | `presentation/complete.service.ts:12-46` |
| la transacción | `../../../shared/data/progress.repository.ts:111-169` |
| "¿está terminado?" | `../../../shared/policy/completion.ts:6-10` |

## 2. Todo en una transacción

Marcar una lección toca cuatro cosas, y **una respuesta a medias sería peor que un error**: una
lección marcada sin mover el marcador deja al alumno volviendo al sitio equivocado; una fecha de
fin sellada sin la lección marcada deja un curso "terminado" con cinco de seis.

Por eso `completeLesson` (`../../../shared/data/progress.repository.ts:111-169`) hace en una sola
transacción: sellar la lección si no lo estaba, dejar al alumno inscrito si no lo estaba, mover
`last_lesson_id` y —solo si toca— sellar `enrollments.completed_at`.

**Marcar implica estar inscrito** (`:129-132`). El alumno puede llegar a una lección sin haber
pulsado "Empezar curso" —desde una muestra gratuita, desde un enlace directo—, y una marca que no
aparece en "Mis cursos" es una marca perdida: la única pantalla que enseña el progreso lista
inscripciones. Se resuelve con el mismo `INSERT … ON CONFLICT DO NOTHING` del enroll, así que
también aquí marcar dos veces deja una sola fila.

## 3. "La última lección que faltaba" — la trampa

Se calcula sobre **las lecciones publicadas en ese momento**, no sobre las que había cuando el
alumno empezó. El service pide la lista justo antes de escribir
(`presentation/complete.service.ts:19`) y la transacción cuenta contra ella (`:24` →
`../../../shared/data/progress.repository.ts:139-145`).

De ahí salen tres comportamientos, y los tres son deliberados:

| Situación | Qué pasa | Por qué |
| --- | --- | --- |
| el alumno completa la última que faltaba | se sella `enrollments.completed_at` | es el "terminaste el 3 jul" de la pantalla 10 |
| **mañana se publica una séptima lección** | el curso deja de estar al día y vuelve a "Continuar" | el alumno tiene una lección nueva por ver; ocultárselo sería mentirle |
| esa séptima se publica y el alumno no vuelve | **la fecha de fin NO se borra** | reescribir el pasado de la pantalla de alguien por un cambio editorial es peor que un contador momentáneamente optimista |

Lo que **no** se hace es recalcular hacia atrás. No hay ninguna tarea que recorra las
inscripciones al publicar una lección: la fecha se recalcula **al siguiente movimiento del
alumno**, y hasta entonces se queda como estaba. La pantalla 10 lo resuelve pidiendo las dos
condiciones a la vez —fecha sellada **y** curso al día— en `isEnrollmentFinished`
(`../../../shared/policy/completion.ts:12-16`), así que un curso con una lección nueva aparece en
"Continuar" **sin** que nadie haya tocado su `completed_at`.

Y cuando el alumno completa esa séptima lección, la fecha original sigue siendo la que era: el
sellado va con la guarda `completed_at: null`
(`../../../shared/data/progress.repository.ts:153-156`), así que solo escribe si no había fecha.
Comprobado con `curl` contra la base real: se publicó una séptima lección, el curso volvió a
`in_progress`, la fecha en la tabla siguió intacta y al completarla la respuesta devolvió **la
fecha vieja**.

## 4. Marcar exige poder ver la lección

`requireMarkableLesson` (`../../../shared/domain/markable_lesson.ts:21-47`) va **antes** de
cualquier escritura (`presentation/complete.service.ts:15`). Reutiliza `canViewLesson` de la fase
10 componiéndola con la pregunta que aquí hace falta —¿la lección y su curso siguen publicados?—:
el porqué está en `../../../shared/docs/README.md` §4.

| Caso | Respuesta |
| --- | --- |
| la lección no existe | `404 NOT_FOUND` |
| en borrador, o de un curso archivado | `403 LESSON_LOCKED`, y **no se escribe nada** |

Hay tests de los dos casos —a través de la cadena real, no del service mockeado— en
`test/complete.controller.test.ts`, y uno contra PostgreSQL real archivando un curso de verdad
(`tests/integration/postgres/progress_flow.test.ts`).

## 5. La respuesta trae la inscripción entera

`{ mark: { lesson_id, completed_at, enrollment } }`. La pantalla que marca es la de la lección, y
justo después necesita repintar el contador ("3 de 6") y saber si el curso acaba de terminarse.
Devolver solo `{ ok: true }` obligaría a una segunda petición a `/me/courses` después de **cada**
marca.

`enrollment` puede ser `null` en `DELETE` —si el alumno nunca se inscribió— pero nunca aquí: esta
action inscribe si hace falta. El tipo es compartido por las dos actions
(`ApiLessonMark`, `../../../shared/domain/progress.types.ts:50-54`) y por eso admite el `null`.

## 6. Los tests

- `test/complete.service.test.ts` — se marca con las publicadas de ese momento; la respuesta trae
  el contador al día; completar la última devuelve el curso sellado y `next_lesson: null`; con una
  lección nueva publicada el curso ya no está al día **pero conserva su fecha**.
- `test/complete.controller.test.ts` — el sobre, el `403 LESSON_LOCKED` del curso archivado y de la
  lección en borrador (con la guardia **de verdad**, no mockeada), el `404`, el `401` y las tres
  del `DELETE`.
