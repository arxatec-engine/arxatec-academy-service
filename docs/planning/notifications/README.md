# Avisos y pedidos de tema

**Estado:** implementado. [Módulo](../../../src/modules/notifications/docs/README.md) ·
[Schemas](../../../src/modules/notifications/shared/domain/notification.schema.ts) · [Índice](../README.md).
El módulo registra interés y permite administrarlo; no entrega campañas masivas.

## Altas públicas y correo efectivo

| Ruta bajo `/api/v1`           | Entrada                                | Resultado                                    |
| ----------------------------- | -------------------------------------- | -------------------------------------------- |
| `POST /notifications/signups` | email si anónimo; course_slug opcional | 200 sin data, también al repetir             |
| `POST /notifications/topics`  | email si anónimo; search_term          | 200 sin data; repetición incrementa contador |

Con Bearer válido se usa el correo de la sesión y se descarta el email del body antes de
validarlo. Un token inválido equivale a anónimo: debe proporcionar email. No se exige correo
verificado. El correo explícito usa normalización/validación común.

Omitir course_slug registra aviso de catálogo general; si se envía, debe identificar un curso
publicado o devuelve 404. No registra avisos para un borrador aunque el cliente conozca su slug.
search_term rechaza controles ASCII, compacta espacios, exige 1–120 caracteres y genera una versión
normalizada sin mayúsculas/acentos para agrupar.

Las dos acciones comparten límites de 10/h por IP y 5/h por correo. El correo efectivo de la
sesión se usa también en el limitador. La persistencia guarda SHA-256 de sal + IP, no IP en
claro, con NOTIFICATIONS_IP_HASH_SALT. Esa regla pertenece a estas tablas, no a las sesiones auth.

## Unicidad, repetición y datos

`notification_signups` deduplica email/curso. El caso de catálogo general exige el índice único
parcial de la migración para course_id NULL. La inserción usa conflicto ignorado y, si llega
una sesión con un aviso anónimo previo, puede asociarlo al usuario en la misma transacción.
No borra notified_at ni crea una nueva suscripción por repetir el alta.

`topic_requests` tiene una fila por email/término normalizado. Repetir incrementa request_count
y actualiza last_requested_at; no representa una persona nueva. El agregado por tema suma
peticiones y cuenta correos distintos por separado, sin devolver las direcciones en ese DTO.

## Gestión administrativa

Todo `/admin/notifications` exige sesión y ADMIN.

| Método/ruta                                | Entrada                                  | Resultado                    |
| ------------------------------------------ | ---------------------------------------- | ---------------------------- |
| `GET /admin/notifications/signups`         | course_id, notified, page, per_page      | signups y pagination         |
| `GET /admin/notifications/signups/export`  | course_id, notified                      | CSV completo del filtro      |
| `POST /admin/notifications/signups/notify` | course_id nullable, signed_up_before ISO | `{ marked }`                 |
| `GET /admin/notifications/topics`          | Sin filtros declarados                   | topics agrupados por demanda |
| `DELETE /admin/notifications/subscribers`  | Query email                              | 204, o 404 si no hay filas   |

Listado: page desde 1; per_page 25 por defecto, máximo 100; notified usa texto true/false.
Pagination contiene page/per_page/total/has_next. Cada alta devuelve id, email, course nullable
(id/title/slug), created_at, notified_at nullable y has_account. Este último se consulta por
email en usuarios actuales; no significa que el alta estuviera autenticada cuando ocurrió.

Omitir course_id en listado/exportación incluye todos los cursos y catálogo; no hay un selector
especial para «solo catálogo». En el comando de marcado, course_id null sí selecciona catálogo.
signed_up_before es obligatorio y no futuro; se marcan filas no avisadas con created_at menor
o igual al corte. Repetir ese corte devuelve cero para filas ya marcadas.

## CSV, marcado y privacidad

Exportación devuelve email, curso/catálogo y fechas de registro/aviso, con offset de reporte,
BOM y protección de fórmulas. Su límite es 20/h por actor. No aplica ADMIN_EXPORT_MAX_ROWS:
el repositorio carga todo el conjunto y lo convierte en buffer.

El marcado solo escribe notified_at. No llama SMTP ni comprueba que se haya entregado un correo.
La UI debe presentarlo como registro de una gestión, no como evidencia de entrega. Un futuro
envío masivo requiere política de consentimiento, reintentos, bajas y contrato propio.

Eliminar por email borra avisos y pedidos de tema en una transacción; no borra la cuenta.
Borrar la cuenta retira filas asociadas por user_id, pero un aviso anónimo con ese correo y
sin vínculo puede permanecer. No presentar la cascada como búsqueda universal por dirección.

## Aceptación y evolución

[notifications_flow](../../../tests/integration/postgres/notifications_flow.test.ts) comprueba
deduplicación, agrupación, CSV, corte y borrado. Verificar además que body email no suplante una
sesión, que el catálogo general conserve una sola fila y que request_count y distinct_emails
se interpreten como métricas diferentes.

El listado de temas agrupa filas completas en Node y no pagina. Antes de crecer, medir y mover
la agrupación a SQL o añadir un contrato acotado. Separar acciones en slices, implementar envío
y conservar auditoría general son trabajos futuros, no funcionalidades ya presentes.
