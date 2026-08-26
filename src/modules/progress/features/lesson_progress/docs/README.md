# `features/lesson_progress` — el porqué

Las tres actions que escriben lo que el alumno hace **dentro** de una lección.

| Action | Endpoint | Auth | Qué hace |
| --- | --- | --- | --- |
| `update` | `PUT /api/v1/lessons/:lesson_id/progress` | Bearer + 1/s | guarda el minuto y, opcionalmente, completa |
| `complete` | `POST /api/v1/lessons/:lesson_id/complete` | Bearer | "Marcar como completada" |
| `uncomplete` | `DELETE /api/v1/lessons/:lesson_id/complete` | Bearer | desmarcar |

Se montan en `index.ts:9-11` y cuelgan de `LessonsRoutePrefix`
(`src/modules/progress/index.ts:11`).

## 1. Por qué `complete` y `uncomplete` son dos actions y no una con un booleano

Comparten ruta y difieren en el verbo, así que la tentación es un solo slice con un `if`. No lo
son porque **no hacen lo mismo ni cuestan lo mismo**: marcar toca cinco cosas en una transacción
—la lección, la inscripción, el marcador y quizá la fecha de fin del curso— y desmarcar toca dos.
Un `if` en el service dejaría las dos ramas en el mismo archivo, y la rama cara es justo la que
tiene la regla difícil ("la última que faltaba").

Las tres comparten lo que **sí** es común: la guardia `requireMarkableLesson`
(`../../shared/domain/markable_lesson.ts:21-47`), que es una y solo una.

## 2. Las tres exigen Bearer, y por eso el `403` significa otra cosa aquí

En la fase 10, `403 LESSON_LOCKED` quería decir *"crea una cuenta"*. Aquí la cuenta ya existe —el
middleware la exigió— así que el único motivo posible es que la lección **ya no esté disponible**:
en borrador, o en un curso archivado. Mismo código, texto distinto; el porqué está en
`../../shared/docs/README.md` §4.

## 3. `PUT` completa, pero no descompleta

`{ "completed": true }` sella la lección; `{ "completed": false }` —lo que manda el reproductor
en cada latido— **no la desmarca**. Si lo hiciera, el latido borraría la marca de una lección
completada tres segundos después de ponerla. Desmarcar es un gesto explícito del alumno y tiene
su propio verbo: `DELETE`.
