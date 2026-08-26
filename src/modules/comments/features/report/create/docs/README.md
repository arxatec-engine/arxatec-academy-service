# `POST /comments/:id/report` — el porqué

El enlace *"Reportar"* de cada comentario en la pantalla 08. Alimenta la pestaña "Reportados" de
la moderación (pantalla 15, fase 16).

## 1. El recorrido

```text
POST /api/v1/comments/:id/report
  → authenticateTokenJwt            sin sesión → 401 UNAUTHENTICATED
  → createCommentReportController   usuario → parse → service → 200
  → createCommentReportSchema       user_id (sesión) + comment_id (ruta) + reason (opcional)
  → createCommentReportService      ¿el comentario existe? → INSERT … ON CONFLICT DO NOTHING
  → 200, sin `data`
```

| Paso | Archivo |
| --- | --- |
| cadena de la ruta | `presentation/create.routes.ts:9-13` |
| usuario → validación → service → respuesta | `presentation/create.controller.ts:12-29` |
| reglas | `presentation/create.service.ts:5-15` |
| escritura idempotente | `../../../shared/data/comments.repository.ts:68-77` |

## 2. Idempotente por el índice, no por un `if`

`@@unique([comment_id, reported_by_user_id])` (`prisma/schema/comments.prisma:36`) es lo que hace
que cada persona cuente **una vez** por comentario. Sin él, alguien con un botón y ganas infla el
contador de la pestaña "Reportados" y la moderación deja de servir para lo único que sirve:
priorizar.

La escritura es `createMany({ skipDuplicates: true })`, es decir
`INSERT … ON CONFLICT DO NOTHING`. Dos peticiones a la vez terminan las dos en `200` con **una**
fila; con un `select` + `if` + `insert` habría una ventana en la que las dos leen "no existe" y la
segunda revienta con un `500`.

**El primer `reason` es el que queda.** El `DO NOTHING` no actualiza: si alguien reporta con
motivo y luego sin él, en la base sigue el motivo original. Es lo correcto —el motivo es lo que
esa persona quiso decir la primera vez— y está comprobado contra la base real
(`tests/integration/postgres/comments_flow.test.ts`, caso 10).

## 3. La respuesta **no** dice si ya lo habías reportado

Las dos llamadas devuelven el mismo `200`, el mismo texto y **sin `data`**. No es pereza:

1. **No aporta nada.** El frontend ya pintó el comentario como reportado; repetir el clic solo
   pasa si el usuario recargó o volvió atrás, y en ese caso lo que quiere ver es "gracias", no
   "ya lo habías hecho".
2. **Sí filtra estado.** Distinguir "creado" de "ya existía" convierte el endpoint en un oráculo:
   con una cuenta y unas cuantas peticiones se puede ir preguntando por comentarios ajenos y
   deducir qué hilos están siendo reportados y por quién. Un `409` haría lo mismo, más ruidoso.

La consecuencia asumida: el frontend no puede recuperar tras un refresco qué comentarios reportó
esta persona. Cuando alguna pantalla lo necesite, el sitio es el listado —añadiendo
`optionalAuthenticate` y un booleano por comentario—, no el resultado del reporte.

## 4. Reportar **no** exige el correo verificado

Es la única de las tres rutas de escritura sin `requireVerifiedEmail`
(`presentation/create.routes.ts:9-13`), y es a propósito. Un reporte no publica nada, no es
visible para nadie y su peor caso es una fila de más en una pestaña de admin; avisar de algo grave
—un insulto, un dato personal ajeno, spam— no puede quedarse esperando a que alguien abra su
correo. La verificación existe para lo que **se publica con tu nombre**, que es justo lo que un
reporte no hace.

Hay un test explícito para que quitar esa asimetría no pase inadvertido
(`test/create.controller.test.ts`, *"reportar NO exige el correo verificado"*).

## 5. Se reporta lo oculto y lo borrado

El guardián es `requireComment` (`../../../shared/domain/comment_target.ts:14-22`), que solo
comprueba que exista: **no mira el estado**. Un comentario que un moderador acaba de ocultar sigue
aceptando reportes, porque el que reporta pudo tenerlo en pantalla desde antes y explicarle que su
clic llegó tarde no le aporta nada. La fase 16, que es la que lee estos contadores, ya filtra por
estado en su propia consulta.

## 6. `reason` es opcional, corto y se normaliza a `null`

Máximo 280 caracteres (`CommentPolicy.reason_max_length`), recortado, y **la cadena vacía se
guarda como `null`** (`domain/create.schema.ts:12-19`): un `reason: ""` en la base es ruido que
obliga a todo lector a distinguir dos formas de "no dijo nada". El tope corto es deliberado: el
motivo es una etiqueta para priorizar, no un canal de soporte.

## 7. Los tests

- `test/create.service.test.ts` — el reporte con el usuario de la sesión, el motivo que viaja tal
  cual, el `void` de vuelta, las dos escrituras iguales y el `404` que **no** escribe.
- `test/create.controller.test.ts` — el `200` **sin `data`**, las dos llamadas con el mismo
  cuerpo, el `reason` recortado y el `null` cuando falta, el `401`, el `422` del motivo largo, el
  `404` propagado y la ausencia deliberada de `requireVerifiedEmail`.
- `tests/integration/postgres/comments_flow.test.ts` (casos 10 y 11) — dos reportes de la misma
  persona dejan **una** fila con el motivo original; dos personas distintas dejan dos.
