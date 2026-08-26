# `GET /me/courses` — el porqué

Todo lo que pinta la pantalla 10, en una sola llamada. Y **E3** —"Todavía no has empezado ningún
curso"— que **no es un error**.

## 1. El recorrido

```text
GET /api/v1/me/courses            (Bearer obligatorio)
  → authenticateTokenJwt          sin sesión → 401
  → getMyCoursesController        usuario → parse → service → 200
  → getMyCoursesService           inscripciones → cursos publicados → lecciones → completadas
  → 200 { in_progress: [...], completed: [...] }
```

| Paso | Archivo |
| --- | --- |
| cadena de la ruta | `presentation/get_list.routes.ts:9` |
| usuario → validación → service → respuesta | `presentation/get_list.controller.ts:10-23` |
| reglas y armado | `presentation/get_list.service.ts:33-88` |
| el reparto de cada curso | `../../../shared/policy/completion.ts:12-16` |

```jsonc
{
  "data": {
    "in_progress": [
      { "course": { "slug": "…", "title": "Fundamentos de legal tech" },
        "completed_lessons": 2, "lesson_count": 6,
        "next_lesson": { "slug": "…", "title": "Las cuatro herramientas…" } }
    ],
    "completed": [
      { "course": { "slug": "…", "title": "Expedientes sin Excel" },
        "lesson_count": 4, "completed_at": "2026-07-03T00:00:00.000Z" }
    ]
  }
}
```

## 2. Dos listas, no una con un campo `status`

La pantalla las pinta distinto —"Continuar" contra "Ver de nuevo"— y cada tarjeta enseña datos
distintos: la de arriba, un contador y la lección por la que sigue; la de abajo, la fecha en la
que terminó. Una sola lista con un `status` obligaría al frontend a ramificar en el render y a
llevar campos que sobran en la mitad de los elementos.

Que **las dos** salgan vacías es E3: `200` con `{ "in_progress": [], "completed": [] }`, sin
`meta`, sin `404`. Un vacío es una respuesta correcta a una pregunta correcta; el texto
"Todavía no has empezado ningún curso" es cosa del frontend. Hay un test explícito
(`test/get_list.controller.test.ts`) y un `curl` contra dos cuentas recién registradas.

Cuando no hay inscripciones, el service **corta ahí** (`presentation/get_list.service.ts:38-40`):
cero consultas más. La cuenta nueva es el caso más frecuente del endpoint.

## 3. Cuatro consultas para N cursos, no cuatro por curso

`presentation/get_list.service.ts:36-53`:

1. las inscripciones del alumno, ordenadas por `started_at` descendente;
2. **los cursos publicados** de esas inscripciones, de una vez;
3. las lecciones publicadas de todos esos cursos, de una vez, agrupadas después en memoria con
   `groupLessonsByCourse` (`../../../shared/domain/course_progress.ts:29-42`);
4. las lecciones completadas del alumno, **acotadas a esos ids**.

Con cuatro cursos empezados, la versión ingenua —un contador por curso— haría trece consultas. El
punto de corte es conocido: cuando un alumno tenga cientos de inscripciones habrá que paginar, y
lo que hay que cambiar es este service, no el contrato.

La consulta 4 filtra por `lesson_id: { in: … }` en vez de traer todo el progreso del alumno
(`../../../shared/data/progress.repository.ts:78-88`): el conjunto que importa es siempre el de
las lecciones publicadas de sus cursos.

## 4. Un curso está "terminado" solo si lo está **ahora**

`isEnrollmentFinished(enrollment, progress.is_completed)`
(`presentation/get_list.service.ts:70`, `../../../shared/policy/completion.ts:12-16`) exige **las
dos** cosas:

- que la inscripción tenga fecha de fin sellada, y
- que **todas las lecciones publicadas hoy** estén completadas.

De ahí sale el comportamiento que pide la fase 11 §2: si mañana se publica una séptima lección en
un curso terminado, la tarjeta vuelve a "Continuar" con `6 de 7` y apuntando a la nueva —**sin que
nadie haya tocado `completed_at` en la base**—. La fecha sigue ahí y vuelve a valer en cuanto el
alumno complete la nueva. Comprobado con `curl` y contra PostgreSQL real.

El caso simétrico también está cubierto: una inscripción con fecha sellada cuyo curso se quedó sin
lecciones publicadas **no** aparece como terminada, porque `isCourseCompleted` exige
`published_lesson_count > 0`.

## 5. Un curso archivado desaparece de la lista

La consulta 2 filtra por `status: PUBLISHED`
(`src/modules/courses/shared/data/course_refs.repository.ts:33-40`), y una inscripción cuyo curso
no aparezca se salta (`presentation/get_list.service.ts:59-63`).

Es una decisión, no un descarte silencioso: la tarjeta lleva a `/courses/:slug`, que responde
`404` desde la fase 09 para un curso archivado. Pintarla sería ofrecer un enlace roto. **La
inscripción no se borra**: si el curso se vuelve a publicar, vuelve a aparecer con su progreso
intacto.

## 6. El orden: lo último empezado arriba, lo último terminado arriba

`in_progress` sale en el orden de las inscripciones, que es `started_at` descendente
(`../../../shared/data/progress.repository.ts:57-64`): lo que el alumno empezó hace poco es lo que
más probablemente quiere continuar.

`completed` se ordena por `completed_at` descendente en el service
(`presentation/get_list.service.ts:84-86`), no en SQL, porque la fecha que manda es la de la
inscripción y la lista ya está en memoria: son unos pocos elementos y ordenar aquí evita una
segunda consulta ordenada.

## 7. Lo que esta respuesta NO trae

- **Ni un solo id interno.** El curso viaja por `slug`, la siguiente lección por `slug` y `title`.
- **Ni `last_lesson_id`.** La columna existe en la tabla —es el marcador "Sigues en…"— pero la
  pantalla 10 pinta **la siguiente no completada**, que es lo que enseña el brief
  (*"Sigues en: Las cuatro herramientas…"*, con 2 de 6). Cuando alguna pantalla necesite "la
  última que tocaste" en vez de "la siguiente que falta", el dato ya está guardado.
- **Ni contenido de lección.** El `select` no pide `article_body`, `transcript` ni el video.

## 8. Los tests

- `test/get_list.service.test.ts` — cero inscripciones (**y cero consultas más**); el reparto en
  dos listas; `next_lesson` es la primera **no completada**; la lección nueva que devuelve un
  curso terminado a "Continuar"; el curso archivado que desaparece; la fecha sellada sin lecciones
  publicadas que no cuenta como terminado; y que las completadas se piden acotadas a las
  publicadas.
- `test/get_list.controller.test.ts` — el sobre con las dos listas vacías **sin `meta`**, el
  `user_id` que sale de la sesión, el `401` sin Bearer y el `401` con un Bearer con basura.
