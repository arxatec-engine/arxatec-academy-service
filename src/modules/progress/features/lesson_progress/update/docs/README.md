# `PUT /lessons/:lesson_id/progress` — el porqué

La llamada que sostiene la promesa de **E7**: *"vuelves a esta misma lección, en el minuto donde
la dejaste"*. La manda el reproductor cada pocos segundos, así que es el endpoint más llamado del
producto y el único con un rate limit de un segundo.

## 1. El recorrido

```text
PUT /api/v1/lessons/:lesson_id/progress   (Bearer obligatorio)
  → authenticateTokenJwt          sin sesión → 401, sin tocar la base
  → lessonProgressRateLimit       1 por segundo y por usuario → 429 RATE_LIMITED
  → updateLessonProgressController  usuario → cuerpo → parse → service → 200
  → updateLessonProgressSchema    lesson_id + last_position_seconds (entero ≥ 0) + completed
  → updateLessonProgressService   guardia de acceso → guardar minuto → (opcional) completar
  → progress.repository           INSERT ON CONFLICT DO NOTHING + UPDATE … WHERE minuto < nuevo
  → 200 { progress: { lesson_id, last_position_seconds, completed_at, updated_at } }
```

| Paso | Archivo |
| --- | --- |
| cadena de la ruta | `presentation/update.routes.ts:10-15` |
| lectura del cuerpo y validación | `presentation/update.controller.ts:12-21` |
| reglas | `presentation/update.service.ts:11-38` |
| el upsert | `../../../shared/data/progress.repository.ts:90-109` |

## 2. El servidor no acepta un retroceso del minuto

Si llega un `last_position_seconds` **menor** que el guardado, se ignora y la respuesta devuelve
el valor que ya había. No es una comodidad: sin esa regla, un latido que sale en el segundo 30 y
llega **después** del que salió en el 252 —una reconexión, un móvil que cambia de red— devuelve al
alumno al minuto 2 la próxima vez que abra la lección.

La regla vive en el `WHERE` de un `UPDATE`
(`../../../shared/data/progress.repository.ts:100-103`), no en un `if` del service: entre leer y
escribir en Node cabe otra petición del mismo usuario, y en un `UPDATE … WHERE minuto < $1` no
cabe nada. El porqué completo, con la tabla de las tres sentencias, está en
`../../../shared/docs/README.md` §2.

**Rebobinar de verdad se hace desde `complete`/`uncomplete`, no aquí.** El brief no pide un
"volver al principio" explícito; el día que lo pida, será un campo nuevo del cuerpo y no un
cambio de esta regla.

## 3. `completed: true` completa; `completed: false` no descompleta

El reproductor manda `completed: false` en **cada** latido. Si eso desmarcara, una lección
completada se descompletaría tres segundos después. Por eso:

- `completed: true` → se sella la lección con la misma transacción que usa
  `POST /lessons/:id/complete` (`presentation/update.service.ts:28-35`), incluidas la inscripción
  y la posible fecha de fin del curso;
- `completed: false` o ausente → solo el minuto (`:24-26`).

Es el mismo `completeLesson` del repositorio, no una segunda copia de la regla: la única
diferencia con la action `complete` es que aquí la respuesta es el progreso de la lección, no la
inscripción entera, porque quien llama es el reproductor y no la pantalla.

## 4. La respuesta es el estado guardado, no el que llegó

El cuerpo devuelve lo que hay en la base **después** de escribir
(`../../../shared/data/progress.repository.ts:105-108`). Eso es lo que permite al cliente
detectar que su valor se ignoró por llegar tarde: mandó 30, recibe 252. Si devolviéramos lo que
mandó, el reproductor no tendría forma de enterarse.

## 5. El rate limit es de un segundo, y va después de la autenticación

`lessonProgressRateLimit` (`src/middlewares/rate_limit.ts:114-118`) agrupa por `userKey`, así que
tiene que ir **después** de `authenticateTokenJwt` (`presentation/update.routes.ts:12-13`): antes,
`req.user` no existe y el límite se degradaría a la IP —una oficina entera compartiría un guardado
por segundo—.

Un guardado por segundo es generoso para el reproductor, que guarda cada varios segundos, y corta
en seco el bucle de un cliente con un bug. El `429` sale con el sobre de siempre y
`retry_after_seconds: 1`; comprobado con dos `curl` seguidos.

## 6. Validación: el minuto es un entero acotado

`domain/update.schema.ts:13-16`: entero, `≥ 0` y `≤ 86 400` (`ProgressPolicy`,
`src/constants/progress.ts:1-5`). Un decimal, un negativo o un número absurdo son
`422 VALIDATION_ERROR` con la clave i18n `progress.errors.position_invalid`, y **no llegan a la
base**. El tope de un día no protege de un ataque —el endpoint ya exige sesión— sino de una
columna con basura que luego alguien tiene que interpretar.

El cuerpo se lee con un lector defensivo (`presentation/update.controller.ts:11-12`) porque
`req.body` es lo que mande el cliente: puede ser `null`, un array o un número suelto. Zod valida
después; el lector solo evita que el acceso a la propiedad reviente antes.

## 7. Los tests

- `test/update.service.test.ts` — el minuto se guarda; sin `completed` **no** se pide el temario
  ni se toca la inscripción; con `completed` se sella con las publicadas de ese momento; una
  lección de un curso archivado responde `403` y **no guarda nada**; una inexistente, `404`.
- `test/update.controller.test.ts` — el sobre, el `user_id` de la sesión, el `completed` que por
  defecto es `false`, el `422` del minuto negativo con su clave i18n, el del decimal, el del
  cuerpo vacío y el `401` sin Bearer.
- La regla del retroceso y la carrera del upsert se prueban donde viven: en
  `../../../shared/test/progress_repository.test.ts` (la forma de las sentencias) y en
  `tests/integration/postgres/progress_flow.test.ts` (contra PostgreSQL real).
