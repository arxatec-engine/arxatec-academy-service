# `features/my_courses` — el porqué

| Action | Endpoint | Auth | Pantallas |
| --- | --- | --- | --- |
| `get_list` | `GET /api/v1/me/courses` | Bearer | 10 Mis cursos · **E3** (sin nada empezado) |

Se monta en `index.ts:7` y cuelga de `MeRoutePrefix` (`src/modules/progress/index.ts:12`).

## 1. `/me/courses` no colisiona con `/auth/me`

Son dos prefijos distintos: `authRouter` cuelga de `${ApiPrefix}${AuthRoutePrefix}`
(`src/routes/index.ts:12`) y esta ruta de `${ApiPrefix}${MeRoutePrefix}`
(`src/modules/progress/index.ts:12`). `/api/v1/auth/me` y `/api/v1/me/courses` no comparten
ningún camino.

`MeRoutePrefix` existía desde la fase 08 (`src/constants/endpoints.ts:39`) reservado para las
rutas del alumno autenticado. Ésta es la primera que lo usa; la fase 13 le colgará el perfil.

## 2. Una llamada, una pantalla

La pantalla 10 pinta dos listas y un contador por tarjeta. Todo eso sale de **esta** llamada: no
hay un `GET /me/enrollments` que luego pida el progreso curso por curso. El motivo es la pantalla,
no la elegancia: con cuatro cursos empezados, la versión troceada haría nueve peticiones y
pintaría las tarjetas de una en una.

El detalle de cómo se arma —y por qué son cuatro consultas y no una por curso— está en
`get_list/docs/README.md`.
