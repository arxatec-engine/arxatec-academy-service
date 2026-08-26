# `features/thread` — el porqué

Las tres actions que tocan un hilo: leerlo, empezarlo y contestarlo.

| Action | Endpoint | Auth |
| --- | --- | --- |
| `get_list` | `GET /api/v1/lessons/:lesson_id/comments` | pública |
| `create` | `POST /api/v1/lessons/:lesson_id/comments` | Bearer + correo verificado + 5/h |
| `reply` | `POST /api/v1/comments/:id/replies` | Bearer + correo verificado + 5/h |

## 1. Por qué la feature exporta **dos** routers

`index.ts:7-14` exporta `lessonThreadRouter` (listar y crear, que cuelgan de `/lessons`) y
`commentThreadRouter` (responder, que cuelga de `/comments`). Es la misma feature —un hilo— con
dos prefijos, porque el sujeto de la URL cambia: un comentario nuevo pertenece a **una lección**,
una respuesta pertenece a **un comentario**.

La alternativa —un solo router con las rutas absolutas dentro— obligaría a repetir `/lessons` y
`/comments` en cada `*.routes.ts`, que es exactamente lo que `02_reglas_backend.md` §3 evita al
poner el prefijo una sola vez. El módulo los monta en `../../index.ts:9-10`.

**El orden dentro de `lessonThreadRouter` no importa**: `GET` y `POST` sobre el mismo path los
distingue el método.

## 2. Lo que comparten las tres

El cuerpo (1 a 2 000 caracteres, recortado, texto plano) está escrito **dos veces**, en
`create/domain/create.schema.ts:12-17` y en `reply/domain/reply.schema.ts:12-17`, apoyándose las
dos en `CommentPolicy` y en las mismas claves i18n. No se factorizó a un schema compartido a
propósito: son dos contratos de entrada distintos —uno lleva `lesson_id`, el otro `comment_id`— y
`02_reglas_backend.md` §3 pone el schema en el `domain/` de su action. Los números y los textos, que
es lo que de verdad no puede divergir, sí están en un solo sitio (`src/constants/comments.ts`).

Lo que sí se comparte es todo lo que va después: el mapper del autor, los guardianes y el
repositorio, en `../../shared/` (ver su `docs/README.md`).
