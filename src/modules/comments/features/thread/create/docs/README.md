# `POST /lessons/:lesson_id/comments` — el porqué

El campo de preguntar de la pantalla 08, y el aviso de E5 cuando el correo aún no está verificado.

## 1. El recorrido

```text
POST /api/v1/lessons/:lesson_id/comments
  → authenticateTokenJwt     sin sesión → 401 UNAUTHENTICATED
  → requireVerifiedEmail     sin verificar → 403 EMAIL_NOT_VERIFIED, sin tocar la base
  → commentRateLimit         el sexto de la hora → 429 RATE_LIMITED
  → createCommentController  usuario → parse → service → 201
  → createCommentSchema      user_id (sesión) + lesson_id (ruta) + body (cuerpo, recortado)
  → createCommentService     ¿lección publicada? → INSERT → mapper
  → 201 { comment: { id, parent_id: null, body, created_at, author } }
```

| Paso | Archivo |
| --- | --- |
| cadena de la ruta | `presentation/create.routes.ts:11-17` |
| usuario → validación → service → respuesta | `presentation/create.controller.ts:12-29` |
| reglas | `presentation/create.service.ts:7-19` |
| escritura | `../../../shared/data/comments.repository.ts:57-66` |

## 2. El cuerpo se guarda como **texto plano**, y eso es la decisión de esta action

`createCommentSchema` (`domain/create.schema.ts:12-17`) acepta un `string`, lo recorta por los
extremos y exige de 1 a 2 000 caracteres. **No acepta HTML, no acepta Markdown y no sanea nada**:
lo que llega es lo que se guarda, byte a byte, y lo que sale por la API es lo mismo
(`tests/integration/postgres/comments_flow.test.ts`, caso 14).

Aceptar HTML "por si acaso" —por si algún día alguien quiere negritas— es abrir un XSS almacenado
a cambio de nada: bastaría con que **una** pantalla pintara el cuerpo con `innerHTML` para que un
`<script>` guardado en 2026 se ejecutara en el navegador de todos los que abran esa lección en
2027, y esa pantalla la escribe otra persona, otro día, sin leer este README. Con texto plano, el
peor caso de un `<script>` en el cuerpo es que se lea literalmente en la página.

**Tampoco se escapa al guardar.** Escapar en la escritura es la otra forma clásica de equivocarse:
deja la base con `&lt;` dentro y obliga a desescapar en cada consumidor —API, exportación CSV de
la fase 17, correo de moderación de la 16—, y el que se olvide enseña basura o reintroduce el
agujero. **El escapado es del renderizador**, y ahí es donde el frontend lo hace solo.

El día que se quiera formato, la decisión se toma entonces y tiene nombre: un subconjunto de
Markdown renderizado en el cliente, nunca HTML en la base.

## 3. Recortar antes de medir

`.trim()` va **antes** de `.min(1)` y de `.max(2000)` en la cadena de Zod, así que un cuerpo de
solo espacios es un cuerpo vacío y responde `422` con
`fields.body = comments.errors.body_required`. Si se midiera antes de recortar, `"     "` sería un
comentario válido de cinco caracteres y el hilo tendría burbujas en blanco.

Los tres casos —vacío, solo espacios y 2 001 caracteres— están fijados en
`test/create.controller.test.ts` y comprobados con `curl`.

## 4. `user_id` sale de la sesión, nunca del cuerpo

El controller lo lee de `getAuthenticatedUser(req)` y lo mete en el `parse`
(`presentation/create.controller.ts:13-18`); el schema lo exige. Un `user_id` en el cuerpo sería
suplantación en una línea, y el schema de Zod **no lo mira**: aunque llegue, se ignora, porque el
objeto que se parsea lo construye el controller campo a campo.

Lo mismo con `parent_id`: esta action lo escribe siempre a `null`
(`presentation/create.service.ts:14`). Responder tiene su propia ruta y su propio guardián; si
`parent_id` viniera del cuerpo, el límite de un nivel se podría saltar mandando el id de una
respuesta.

## 5. `403 EMAIL_NOT_VERIFIED` es un middleware, no un `if` del service

`requireVerifiedEmail` (`src/middlewares/require_verified_email.ts:5-13`) corta **antes** de que
el controller exista, así que un cuerpo inválido de un usuario sin verificar responde `403` y no
`422`: primero se le dice que no puede escribir, no que escribió mal. Y corta antes del rate
limit, para que un intento que nunca podía prosperar no gaste el cupo de la hora.

El porqué de D-006 —que la verificación no bloquea nada más en todo el producto— está en
`src/middlewares/docs/README.md` §11.

## 6. Cinco por hora, contando también las respuestas

`commentRateLimit` (`src/middlewares/rate_limit.ts:120-124`) es **la misma instancia** que usa
`thread/reply`, así que el cupo es de cinco escrituras por hora entre las dos rutas, agrupadas por
`req.user.id`. Va después de `authenticateTokenJwt` porque antes `req.user` no existe y el
limitador caería a la IP, que en una oficina son varias personas compartiendo cinco comentarios.

Un `422` **sí** gasta cupo: el limitador corre antes que Zod. Es el mismo comportamiento que en
login y es deliberado — un cliente que manda cinco cuerpos vacíos seguidos tiene un bug o mala
intención, y en los dos casos conviene frenarlo.

## 7. Los tests

- `test/create.service.test.ts` — `parent_id: null` siempre, el mapeo del autor, el cuerpo que
  llega **tal cual** al repositorio, el `404` de una lección no publicada y que en ese caso **no
  se escribe nada**.
- `test/create.controller.test.ts` — el `201`, el cuerpo recortado que recibe el service, el `401`
  sin Bearer, el **`403 EMAIL_NOT_VERIFIED`** con la sesión sin verificar, y los cuatro `422`
  (vacío, espacios, ausente y 2 001).
- `test/create_rate_limit.test.ts` — el sexto de la hora es `429 RATE_LIMITED` con
  `retry_after_seconds`. Va en su propio archivo porque el limitador es un módulo con estado: el
  test del controller lo sustituye por un paso directo para no tener que contar peticiones.
