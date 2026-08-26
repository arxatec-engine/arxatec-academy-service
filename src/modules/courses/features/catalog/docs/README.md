# `features/catalog` — el porqué

La cara pública del contenido: las dos pantallas que ve alguien que todavía no tiene cuenta.

| Action | Endpoint | Auth | Pantallas |
| --- | --- | --- | --- |
| `get_list` | `GET /api/v1/courses` | ninguna | 01 Catálogo · E1 (sin cursos) · E2 (búsqueda sin resultados) |
| `get_detail` | `GET /api/v1/courses/:slug` | Bearer **opcional** | 02 Página de curso · E4 (mitad pública) |

Las dos se montan en `index.ts:8-9` y cuelgan de `CoursesRoutePrefix`
(`src/routes/index.ts:13`). El orden importa poco aquí porque `/` y `/:slug` no se solapan, pero
la lista va primero por costumbre: una ruta literal siempre antes que una con parámetro.

## 1. Lo que las dos comparten

**El identificador público es el `slug`, no el `id`.** Es la convención de todas las fases
públicas: el slug es contenido editorial y aparece en la URL que el visitante copia; el id es
interno y solo lo usa el panel de admin. El `id` se pide al `select` cuando hace falta para cruzar
datos, y el mapper no lo copia nunca.

**Solo existe lo publicado.** Un curso `DRAFT` o `ARCHIVED`, y una lección `DRAFT`, **no existen**
para estas dos rutas: no salen en la lista, no cuentan en las facetas, no cuentan en
`lesson_count` y el detalle responde `404`. El filtro va en el `where` de cada consulta
(`../../shared/data/courses.repository.ts:94-106`), no en un `filter` posterior.

**Un solo mapper.** `course_mapper` (`../../shared/domain/course_mapper.ts`) es la única puerta por
la que un curso o una lección salen a la API pública. Si el mapper no lo expone, no se expone.

## 2. Por qué el `data/` de las dos actions es compartido

La receta del `02_reglas_backend.md` §3 pone un `data/<action>.repository.ts` dentro de cada slice.
Aquí no lo hay: las dos actions leen de `modules/courses/shared/data/courses.repository.ts`, que es
lo que manda la fase 09 §4 y lo que dice la política de código compartido (§9.2): *"se usa en
varias actions del mismo módulo → `modules/<m>/shared`"*.

`COURSE_DETAIL_SELECT` y `LESSON_SUMMARY_SELECT` son **listas de seguridad**, no consultas de
conveniencia: son la frontera que impide que `article_body` o `transcript` salgan por una ruta
pública. Duplicarlas en dos slices —y en los de la fase 10, que leen las mismas tablas— sería tener
dos listas que deberían ser iguales y que divergirán el día que alguien añada una columna. Los
tests mockean `@/modules/courses/shared/data/courses.repository` por ese path exacto.

## 3. Lo que estas dos actions NO hacen

- **No entregan contenido de lección.** Ni `article_body`, ni `transcript`, ni el id del video. Eso
  lo sirve `features/lessons` (fase 10), que decide el acceso **antes** de leer esas columnas.
  `is_unlocked` de esta feature es una etiqueta de interfaz, no una autorización: las dos salen de
  la misma función pura, `../../shared/policy/lesson_access.ts:6-7`, pero solo una entrega bytes.
- **No escriben.** Ninguna de las dos toca la base de datos para escribir, y eso incluye la
  renovación deslizante de la sesión: ver `src/middlewares/docs/README.md` §10.
- **No paginan.** Seis cursos. El día que paginen, el punto de corte está documentado en
  `../get_list/docs/README.md` §3.
