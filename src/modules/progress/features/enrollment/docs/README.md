# `features/enrollment` — el porqué

| Action | Endpoint | Auth | Pantallas |
| --- | --- | --- | --- |
| `create` | `POST /api/v1/courses/:slug/enroll` | Bearer | 02 Página de curso (botón "Empezar curso") · 10 Mis cursos |

Se monta en `index.ts:7` y cuelga de `CoursesRoutePrefix`
(`src/modules/progress/index.ts:10`).

## 1. Una feature con una sola action, y va a seguir así

No hay `delete`: **darse de baja de un curso no existe en el brief**. La pantalla 10 solo ofrece
"Continuar" y "Ver de nuevo"; no hay ningún sitio donde el alumno pueda decir "quítame de aquí".
Añadir el endpoint "por simetría" crearía una pregunta de producto que nadie ha hecho —¿se borra
el progreso al salir?— y una ruta que nada llama.

Lo más parecido que sí existe es desmarcar una lección, y eso es
`features/lesson_progress/uncomplete`.

## 2. El curso va por slug, la lección por id

`/courses/:slug/enroll` usa **slug** porque quien pulsa el botón viene de
`/courses/fundamentos-de-legal-tech`, que es la URL pública de la pantalla 02: el frontend no
tiene el id y no debería tenerlo. Las rutas de `lesson_progress`, en cambio, van por **id**,
porque quien las llama es el reproductor, que ya tiene la lección abierta.

Es la convención de `fases_backend/README.md`: lo que el visitante ve por URL va por slug.
