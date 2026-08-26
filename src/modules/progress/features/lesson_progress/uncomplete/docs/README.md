# `DELETE /lessons/:lesson_id/complete` — el porqué

Desmarcar. La mitad silenciosa de la pantalla 08: el alumno que marcó por error, o que quiere
volver a hacer una lección.

## 1. El recorrido

```text
DELETE /api/v1/lessons/:lesson_id/complete   (Bearer obligatorio)
  → authenticateTokenJwt          sin sesión → 401
  → uncompleteLessonController    usuario → parse → service → 200
  → uncompleteLessonService       guardia de acceso → transacción → contadores
  → progress.repository           dos UPDATE en una transacción
  → 200 { mark: { lesson_id, completed_at: null, enrollment } }
```

| Paso | Archivo |
| --- | --- |
| cadena de la ruta | `presentation/uncomplete.routes.ts:9-13` |
| usuario → validación → service → respuesta | `presentation/uncomplete.controller.ts:11-28` |
| reglas | `presentation/uncomplete.service.ts:12-44` |
| la transacción | `../../../shared/data/progress.repository.ts:171-191` |

## 2. Desmarcar borra la fecha del curso, sin condiciones

`uncompleteLesson` (`../../../shared/data/progress.repository.ts:171-191`) hace dos `UPDATE` en
una transacción: `lesson_progress.completed_at = null` y `enrollments.completed_at = null`.

El segundo no lleva guarda a propósito. Si el alumno desmarca **cualquier** lección publicada, el
curso ya no está completo, y dejar la fecha puesta pintaría "Terminado" sobre un curso con un
hueco. Es la única operación de la fase que borra una fecha de fin, y es exactamente lo que pide
la fase 11 §2: *"Al desmarcar, `completed_at` del curso vuelve a `null`"*.

Volver a marcar la vuelve a sellar, con la fecha nueva: el pasado que se protege es el de un
cambio **editorial** (una lección nueva), no el de un gesto del propio alumno.

## 3. No se borra la fila, se borra la marca

`lesson_progress` conserva `last_position_seconds`: desmarcar una lección **no** hace olvidar por
qué minuto ibas. Un `DELETE` de la fila sería más corto de escribir y tiraría el dato que sostiene
E7.

Tampoco se toca `last_lesson_id`: el marcador "Sigues en…" apunta a lo último que el alumno
**hizo**, y desmarcar no es avanzar.

## 4. Desmarcar algo que no estaba marcado responde `200`

Los dos `UPDATE` son `updateMany`: si no hay fila que actualizar, no hacen nada y nadie lanza. Es
idempotente por la misma razón que inscribirse dos veces lo es — el alumno que pulsa dos veces no
ha hecho nada malo — y ahorra al frontend tener que distinguir un caso que no le sirve de nada.

Si el alumno **nunca se inscribió**, la respuesta sale con `enrollment: null`
(`presentation/uncomplete.service.ts:34-41`). No se inscribe a nadie para poder desmarcar: marcar
es empezar un curso, desmarcar no.

## 5. Desmarcar también exige poder ver la lección

Misma guardia que `complete` (`presentation/uncomplete.service.ts:15`): una lección de un curso
archivado responde `403 LESSON_LOCKED` y **no escribe**. Podría parecer inofensivo dejar
desmarcar lo que ya no se puede ver, pero entonces el alumno perdería su marca de un curso que
alguien archivó sin poder volver a ponerla.

## 6. Los tests

- `test/uncomplete.service.test.ts` — desmarca la lección y el curso; el contador baja y
  `next_lesson` vuelve a apuntar a la lección desmarcada; sin inscripción devuelve
  `enrollment: null`; una lección bloqueada **no llega a escribir**.
- El `DELETE` completo, con el sobre y el `403`, está en
  `../complete/test/complete.controller.test.ts`: las dos actions comparten ruta y se prueban
  contra el mismo router (`../index.ts:9-11`).
