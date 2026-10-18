# Comunidad: hilos, reportes y moderación

**Estado:** implementado. [Módulo](../../../src/modules/comments/docs/README.md) ·
[Moderación](../../../src/modules/comments/features/moderation/docs/README.md) · [Índice](../README.md).
La misma tabla sirve al hilo público y a la respuesta editorial del equipo.

## Modelo y superficie pública

`comments` identifica lección, autor nullable, padre nullable, cuerpo y estado
VISIBLE/HIDDEN/DELETED. `comment_reports` deduplica por comentario/reportante y conserva motivo,
fecha de revisión y revisor. Una respuesta apunta a una raíz; el service rechaza responder
a otra respuesta.

| Método/ruta bajo `/api/v1`           | Acceso                     | Resultado                           |
| ------------------------------------ | -------------------------- | ----------------------------------- |
| `GET /lessons/:lesson_id/comments`   | Público                    | 200 con comments y replies visibles |
| `POST /lessons/:lesson_id/comments`  | Bearer + correo verificado | 201 con comment                     |
| `POST /comments/:comment_id/replies` | Bearer + correo verificado | 201 con comment                     |
| `POST /comments/:comment_id/report`  | Bearer                     | 200 sin data, repetible             |

Cuerpo `body` se recorta y exige 1–2000 caracteres. Es texto plano: que contenga etiquetas no
lo transforma en HTML seguro para renderizar. `reason` es opcional hasta 280. Los ids tienen
tope 64 en las acciones públicas. Comentarios y respuestas públicas comparten 5 escrituras/h
por usuario; reportar no tiene ese limitador específico.

El listado devuelve id, parent_id, body, created_at y author nullable con full_name, avatar_url,
affiliation e is_team. Excluye correo, user_id y sesión. affiliation usa independencia u
organización según el perfil; is_team consulta el rol actual. Cambiar un rol cambia la insignia
de lo ya escrito.

El hilo se construye con raíces visibles y sus respuestas visibles. Si se oculta/borra la raíz,
sus respuestas dejan de aparecer aunque sigan teniendo estado VISIBLE. No hay paginación
pública. Una lección no publicada no se entrega por el listado de hilo.

## Herramientas administrativas

`/admin/comments` exige sesión y ADMIN. Las escrituras de moderación comparten 60/h por actor.

| Acción                             | Entrada                                     | Resultado                          |
| ---------------------------------- | ------------------------------------------- | ---------------------------------- |
| `GET /admin/comments`              | tab recent/reported/hidden, page, page_size | comments, counts y pagination      |
| `GET /admin/comments/counts`       | —                                           | counts pending/reported            |
| `POST /admin/comments/:id/replies` | body                                        | 201 con comment y counts           |
| `PATCH /admin/comments/:id/status` | status VISIBLE/HIDDEN                       | 200 con id/status y counts         |
| `DELETE /admin/comments/:id`       | —                                           | 200 con id/status DELETED y counts |

Página empieza en 1; tamaño por defecto 20 y máximo 50. Pagination contiene page, page_size,
total y has_next. El DTO agrega referencia de curso/lección, report_count, is_reply,
is_answered nullable e is_public. No reutilizar la respuesta administrativa como autor público.

`recent` lista visibles de autores que actualmente no son ADMIN; `reported` prioriza reportes
sin revisar por la primera fecha; `hidden` ordena por fecha de ocultación. No son tres formas
de contar todos los comentarios del producto.

## Contadores, revisión y trazabilidad

`reported` cuenta comentarios VISIBLE con al menos un reporte no revisado, no número de reportes.
`pending` cuenta la unión de esos comentarios y raíces VISIBLE de autor no ADMIN sin respuesta
VISIBLE del equipo. No sumar pending + reported: los conjuntos se solapan. Los detalles están
en [métricas](../metrics/README.md).

Cambiar status revisa los reportes abiertos en la misma transacción. Ocultar guarda actor y
fecha al cambiar hacia HIDDEN; volver a visible no borra el historial de ocultación. Borrar es
lógico y revisa reportes. Repetir DELETE devuelve el estado DELETED; intentar PATCH de estado
sobre uno borrado devuelve 409 COMMENT_ALREADY_DELETED.

La respuesta administrativa solo admite una raíz visible. No añade un requisito de email
verificado al ADMIN, a diferencia de las rutas públicas. Hay logs con actor/acción y columnas
de trazabilidad; no existe una bitácora general inmutable con recibos como en Admin.

## Baja, pruebas y pendientes

La FK de autor usa SetNull para borrado directo de usuario, pero la baja HTTP invoca una
limpieza explícita que borra comentarios propios; la cascada del padre puede eliminar respuestas.
Ver [modelo de datos](../data_model/README.md). No prometer anonimización en ese endpoint.

[comments_flow](../../../tests/integration/postgres/comments_flow.test.ts) y
[admin_moderation_flow](../../../tests/integration/postgres/admin_moderation_flow.test.ts) comprueban
visibilidad, reportes, verificación e insignias. La limpieza de la suite afecta los hilos de
lecciones sembradas, por lo que se ejecuta en base desechable.

Quedan fuera edición propia, respuestas multinivel, votos, suscripciones al hilo y eventos de
moderación generales. Las rutas administrativas agrupadas necesitan separación por acción;
el crecimiento del hilo requerirá un contrato de paginación compatible con respuestas.
