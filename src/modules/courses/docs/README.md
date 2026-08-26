# `modules/courses` — el porqué

El módulo del contenido: cursos, lecciones y sus recursos. Nace en la fase 08 con el modelo y las
políticas, en la fase 09 gana su primera superficie HTTP y en la fase 10 la única ruta pública que
entrega contenido.

## 1. El mapa

```text
modules/courses/
├─ features/
│  ├─ catalog/          fase 09 — GET /courses y GET /courses/:slug   (público)
│  │  ├─ get_list/
│  │  └─ get_detail/
│  └─ lessons/          fase 10 — GET /courses/:course_slug/lessons/:lesson_slug
│     └─ get_detail/
└─ shared/
   ├─ data/             courses.repository.ts — las consultas, con select explícito
   ├─ domain/           course.types.ts, course_mapper.ts, course_totals.ts,
   │                    lesson.types.ts, lesson_mapper.ts, lesson_content.types.ts
   └─ policy/           funciones puras: acceso a lección, contenido, posiciones, publicación
```

Lo que viene después ocupa carpetas hermanas y no toca estas:
`features/admin_courses` (fase 14) y
`features/{admin_lessons,admin_resources,admin_video}` (15).

`index.ts:8-9` monta los dos routers del módulo; `src/routes/index.ts:13` los cuelga de
`/api/v1/courses`.

## 2. Las tres invariantes que sostienen lo público

1. **Solo existe lo publicado.** `status: PUBLISHED` va en el `where` de todas las consultas
   públicas (`shared/data/courses.repository.ts:94-106`, `:161`, `:169`), nunca en un filtro
   posterior. Un borrador no se oculta: no se lee.
2. **El contenido no sale por el catálogo.** `article_body`, `transcript` y los datos del video
   están en **un solo** `select` de este módulo, `LESSON_UNLOCKED_SELECT`
   (`shared/data/courses.repository.ts:72-87`), y la función que lo usa solo se llama después de
   que `canViewLesson` haya dicho que sí (`features/lessons/get_detail/presentation/get_detail.service.ts:44-74`).
3. **Nada se denormaliza.** `lesson_count` y `total_duration_seconds` se agregan en la consulta
   (`shared/data/courses.repository.ts:117-133`). No hay columna que mantener y, por tanto, no hay
   columna que pueda mentir.

## 3. Dónde vive el porqué

| Tema | README |
| --- | --- |
| Modelo, políticas puras y la trampa del `@@unique([course_id, position])` | `shared/docs/README.md` |
| La cara pública y lo que comparten sus dos actions | `features/catalog/docs/README.md` |
| La regla de las facetas y la búsqueda sin acentos | `features/catalog/get_list/docs/README.md` |
| El temario público y el contenido que no sale | `features/catalog/get_detail/docs/README.md` |
| La regla de acceso, los dos mappers y `navigation` | `features/lessons/get_detail/docs/README.md` |
| Por qué `lessons` no vive dentro de `catalog` | `features/lessons/docs/README.md` |
| `optionalAuthenticate` y por qué no es un `try/catch` | `src/middlewares/docs/README.md` §10 |
