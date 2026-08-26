# `features/lessons` — el porqué

La única ruta pública que entrega **contenido**. El catálogo vende el curso; esto es lo que se
compra con una cuenta gratuita.

| Action | Endpoint | Auth | Pantallas |
| --- | --- | --- | --- |
| `get_detail` | `GET /api/v1/courses/:course_slug/lessons/:lesson_slug` | Bearer **opcional** | 03 Lección de muestra · 08 Lección video · 09 Lección artículo · E6 (video que no carga) |

Se monta en `index.ts:7` y cuelga de `CoursesRoutePrefix` (`src/routes/index.ts:13`), igual que el
catálogo. Las rutas no se solapan: `/:slug` tiene un segmento y
`/:course_slug/lessons/:lesson_slug` tiene tres.

## 1. Por qué es una feature aparte de `catalog`

Porque la regla de acceso lo es. Las dos actions de `catalog` responden lo mismo a todo el mundo —
`is_unlocked` es una etiqueta de interfaz, no una autorización—; ésta responde **dos cuerpos
distintos con dos estados HTTP distintos** según quién pregunte. Meterla en `catalog` habría dejado
la decisión de acceso más importante del producto dentro de una carpeta que se llama «catálogo».

El reparto que hereda la fase 11: `catalog` dice **qué hay**, `lessons` dice **qué puedes ver**, y
`progress` dirá **por dónde vas**.

## 2. La feature tiene una sola action, y va a seguir teniéndola

Marcar una lección como completada es la fase 11 y vive en `modules/progress`, no aquí: escribe en
otra tabla, exige sesión de verdad (no opcional) y su respuesta no es la lección. Lo que sí
comparte con esta feature es la regla: `canViewLesson` (`../../shared/policy/lesson_access.ts:6-7`)
la volverá a usar para decidir si se puede completar lo que no se puede ver.

## 3. Lo que esta feature NO hace

- **No sirve el video.** Devuelve `provider` y `external_id`; el reproductor es del frontend.
- **No exige el correo verificado.** D-006. Está explicado en `get_detail/docs/README.md` §3.
- **No escribe.** Como el catálogo, y por el mismo motivo:
  `src/middlewares/docs/README.md` §10.
- **No lista lecciones de varios cursos.** El temario completo es del catálogo
  (`GET /courses/:slug`); aquí el temario solo aparece dentro del `403`, para pintar el muro sin
  una segunda petición.
