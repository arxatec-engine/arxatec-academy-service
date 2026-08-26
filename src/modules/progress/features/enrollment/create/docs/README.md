# `POST /courses/:slug/enroll` — el porqué

"Empezar curso" (pantalla 02) y la primera fila de "Mis cursos" (pantalla 10).

## 1. El recorrido

```text
POST /api/v1/courses/:slug/enroll        (Bearer obligatorio)
  → authenticateTokenJwt        sin sesión → 401 UNAUTHENTICATED, sin tocar la base
  → createEnrollmentController  usuario → parse → service → 200
  → createEnrollmentSchema      user_id (de la sesión) + slug (de la ruta)
  → createEnrollmentService     curso publicado → temario → inscripción → completadas
  → progress.repository         createMany(skipDuplicates) + findUniqueOrThrow
  → 200 { enrollment: { course, started_at, completed_at, completed_lessons, lesson_count, next_lesson } }
```

| Paso | Archivo |
| --- | --- |
| cadena de la ruta | `presentation/create.routes.ts:9-13` |
| usuario → validación → service → respuesta | `presentation/create.controller.ts:11-27` |
| reglas | `presentation/create.service.ts:16-41` |
| escritura idempotente | `../../../shared/data/progress.repository.ts:66-76` |

## 2. Inscribirse dos veces devuelve `200`, no `409`

Es la decisión de esta action. El usuario que pulsa "Empezar curso" dos veces —porque volvió
atrás, porque tenía dos pestañas, porque el primer clic no dio señal— **no ha hecho nada malo**, y
un `409` obligaría al frontend a tratar un caso normal como error para acabar haciendo lo mismo:
llevarlo a la lección.

Se resuelve en la base, no en un `if`: `enrollInCourse`
(`../../../shared/data/progress.repository.ts:66-76`) hace
`INSERT … ON CONFLICT DO NOTHING` y luego lee la fila. Dos peticiones a la vez terminan las dos en
`200`, con **una** fila y el **mismo** `started_at`. Comprobado con `curl` y fijado en
`tests/integration/postgres/progress_flow.test.ts` (*"inscribirse dos veces deja UNA fila"*).

**`started_at` no se toca al reinscribirse.** Es la fecha en la que el alumno empezó de verdad;
pisarla en cada clic convertiría "Empezaste el 3 de julio" en "empezaste hace un segundo".

## 3. Devuelve por dónde continuar, no solo un "ok"

El frontend, después de inscribir, tiene que llevar al alumno a algún sitio. Si la respuesta
fuera un `204`, haría una segunda petición para saber a cuál. Por eso el cuerpo trae la
inscripción **con** `next_lesson`, que es:

- la **primera lección publicada no completada**, si ya había progreso;
- la primera del curso, si acaba de empezar;
- `null` si no queda ninguna por ver (curso terminado, o curso sin lecciones publicadas).

Lo calcula `summarizeCourseProgress` (`../../../shared/domain/course_progress.ts:11-27`), la misma
función que usa la pantalla 10: un único sitio donde se decide qué es "la siguiente".

## 4. Un curso que no se puede ver no se puede empezar

`findPublishedCourseBySlug` (`src/modules/courses/shared/data/courses.repository.ts:159-163`)
filtra por `status: PUBLISHED` **en el `where`**, así que un curso en borrador o archivado no se
lee y la respuesta es `404 NOT_FOUND` (`presentation/create.service.ts:21-25`), nunca un `403`.
Igual que en las fases 09 y 10: un `403` sobre un borrador confirmaría que ese slug ya existe.

La inscripción **no se escribe** si el curso no pasa el filtro: el `throw` va antes
(`:21`) que el `enrollInCourse` (`:28`), y hay un test que lo comprueba.

## 5. El correo sin verificar no bloquea (D-006)

Un usuario recién registrado, con `email_verified_at` a `null`, puede empezar un curso. La
pantalla 07 lo promete literalmente: *"Mientras tanto ya puedes ver todos los cursos"*. Aquí no
hay `requireVerifiedEmail`, y no es un olvido: hay un test explícito
(`test/create.controller.test.ts`, *"un usuario sin el correo verificado también puede empezar un
curso"*) para que quitarlo no pase inadvertido.

## 6. Los tests

- `test/create.service.test.ts` — la primera lección al empezar, la primera **no completada**
  cuando ya hay progreso, la idempotencia vista desde el service, el `404` del curso inexistente y
  que en ese caso **no se escribe**.
- `test/create.controller.test.ts` — el sobre completo, el `user_id` que sale de la sesión y no
  del cuerpo, el `401` sin Bearer, la sesión revocada, el `404` propagado y D-006.
