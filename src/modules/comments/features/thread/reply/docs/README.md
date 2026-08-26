# `POST /comments/:id/replies` — el porqué

La respuesta debajo de una pregunta en la pantalla 08, con la insignia *"Equipo Arxatec"* cuando
la escribe el equipo.

## 1. El recorrido

```text
POST /api/v1/comments/:id/replies
  → authenticateTokenJwt     sin sesión → 401
  → requireVerifiedEmail     sin verificar → 403 EMAIL_NOT_VERIFIED
  → commentRateLimit         comparte cupo con crear: 5/h por usuario
  → replyCommentController   usuario → parse → service → 201
  → replyCommentSchema       user_id (sesión) + comment_id (ruta) + body (cuerpo, recortado)
  → replyCommentService      ¿el padre existe, está visible y es raíz? → INSERT → mapper
  → 201 { comment: { id, parent_id, body, created_at, author } }
```

| Paso | Archivo |
| --- | --- |
| cadena de la ruta | `presentation/reply.routes.ts:11-17` |
| usuario → validación → service → respuesta | `presentation/reply.controller.ts:12-29` |
| reglas | `presentation/reply.service.ts:7-19` |
| el guardián del padre | `../../../shared/domain/comment_target.ts:24-40` |

## 2. Responder a una respuesta es `422`, no `404` ni un anidamiento más

El brief dibuja **un solo nivel**: pregunta y respuestas debajo. Anidar más es una decisión de
producto que nadie ha tomado, y la diferencia no es cosmética — un hilo de profundidad libre
necesita colapsado, "ver más respuestas", y una regla de orden distinta.

Por eso `requireRootComment` (`../../../shared/domain/comment_target.ts:24-40`) rechaza un padre
que ya tiene padre con **`422 VALIDATION_ERROR`**: el comentario existe y el que responde tiene
todo el derecho, pero lo que pidió no cabe en la forma del recurso. Un `404` mentiría (existe) y
un `409` diría que hay un conflicto de estado que no hay.

**El límite no se puede saltar por el cuerpo.** `lesson_id` y `parent_id` no vienen del cliente:
salen del padre (`presentation/reply.service.ts:11-16`). Mandar el id de una respuesta es el único
camino para intentar anidar, y ese camino es el que devuelve `422`.

## 3. Responder a algo oculto es `404`

Si el padre está `HIDDEN` o `DELETED`, el guardián responde `404`, no `403` ni `422`: para el
público ese comentario ya no existe, y decir otra cosa confirmaría que un moderador tocó algo ahí.
Es la misma línea que siguen los borradores de las fases 09 y 10.

## 4. La insignia no la decide esta action

`is_team` sale del mapper compartido (`../../../shared/domain/comment_mapper.ts:20-28`) leyendo el
rol **en el momento de responder la petición**. Esta action no guarda nada sobre el equipo: la fila
de un comentario no tiene columna de rol, y por eso bajarle el rol a alguien le quita la insignia
también de lo que ya había escrito. El porqué largo está en `../../../docs/README.md` §4.

## 5. El verbo `reply` no está en la lista canónica, y aquí gana

`02_reglas_backend.md` §3 fija los verbos (`create`, `get`, `get_list`, …) y `reply` no está entre
ellos. El candidato canónico sería `create`, pero el slice ya se llamaría
`features/thread/create` — que existe y es otro— y quedaría `thread/create` y `thread/create_reply`,
que es peor de leer. `fases_backend/fase_12_comentarios.md` §3 nombra la carpeta `reply/`
explícitamente. Queda anotado: es una excepción consciente, no un despiste.

## 6. Los tests

- `test/reply.service.test.ts` — la lección heredada del padre, la insignia de un `ADMIN`, el
  `422` de responder a una respuesta y el `404` del padre inexistente, comprobando en los dos que
  **no se escribe**.
- `test/reply.controller.test.ts` — el `201` con el sobre completo, el `user_id` de la sesión, el
  `401`, el `403 EMAIL_NOT_VERIFIED`, el `422` propagado y el `422` de un cuerpo en blanco.
- `tests/integration/postgres/comments_flow.test.ts` (casos 5, 6 y 9) — la insignia contra la base
  real, cómo cambia al bajarle el rol al autor, y el `422` que además deja **cero filas** colgando
  de la respuesta.
