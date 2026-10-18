# Reutilización de endpoints y límites entre productos

**Estado:** inventario de rutas implementadas. [API](../../API.md) · [Índice](../README.md).
Compartir la arquitectura con Admin no comparte identidades, permisos o DTOs.

## Identidades y prefijos reales

Academy recibe JWT Bearer y consulta auth_sessions de Academy. Admin usa su propia identidad
y cookie; Lawyer tiene sus reglas de producto. Un nombre/email igual en otra base no vincula
actores automáticamente. No enviar cookies de Admin ni JWT de Lawyer a rutas Academy.

El panel editorial de Academy usa `/api/v1/admin` del mismo servicio. El prefijo indica
autorización ADMIN de Academy, no una delegación a arxatec-admin-service.

## Qué reutiliza cada pantalla

| Necesidad              | Endpoint/contrato existente                    | Evita                                                      |
| ---------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| Explorar cursos        | GET /courses y /courses/:slug                  | Copiar catálogo al directorio o a otro backend             |
| Abrir contenido        | GET /courses/:course_slug/lessons/:lesson_slug | Leer el editor admin para obtener contenido del alumno     |
| Identidad de operación | lesson.id del temario                          | Adivinar ids desde slugs o consultar Prisma desde frontend |
| Cuenta actual          | GET /auth/me; PATCH /me/profile para editar    | Usar listado administrativo para iniciar sesión            |
| Aprendizaje personal   | /me/courses y /me/summary                      | Presentar globales del directorio como estado individual   |
| Editar contenido       | /admin/courses y /admin/lessons                | Dar capacidad de escritura al endpoint público             |
| Responder como equipo  | /admin/comments/:id/replies                    | Elevar el rol a partir de un campo del comentario          |
| Exportar usuarios      | /admin/users/export                            | Descargar páginas y construir un CSV distinto en navegador |
| Administrar avisos     | /admin/notifications                           | Mezclar directorio de cuentas con altas anónimas           |

Las consultas públicas/editoriales de cursos seleccionan proyecciones diferentes aunque lean
las mismas tablas. Mantener las dos superficies preserva acceso a borradores y contenido
bloqueado sin obligar al cliente a ocultarlo visualmente.

## Reutilización dentro del backend

Auth publica identidad/sesiones en shared; courses publica referencias de curso/lección;
progress publica conteo de cierres y limpieza para user; comments publica limpieza de datos
propios. Cada operación conserva la transacción que necesita mediante cliente tx explícito.

No importar un data privado de otra acción o módulo para ahorrar un archivo. Los DTOs de
lectura no son una API interna de persistencia: un ref mínimo con estado/id sirve mejor al
progreso que devolver todo el artículo o el editor.

## Contratos que no son equivalentes

El total de cursos cerrados del directorio no equivale a Mis cursos completed; el primero usa
fechas persistidas y el segundo exige estar al día. La paginación de usuarios está en meta y
la de avisos/moderación en data. Sus filtros tampoco tienen los mismos nombres.

POST /notifications/topics incrementa demanda al repetir; signup deduplica. Moderation DELETE
es lógico y devuelve 200; DELETE de lección es físico y devuelve 204. No construir un adaptador
universal suponiendo la misma semántica para todos los recursos.

## Integraciones futuras

Si Admin necesita métricas Academy, diseñar una identidad interna y un contrato propio con
campos/alcance acotados; no se ha implementado aquí un puente M2M ni un reader secundario.
Tampoco hay catálogo externo de planes ni feed de releases que deba aparecer por similitud
con Admin. Verificar propiedad de datos, permisos y cambios coordinados antes de compartirlos.

La aceptación es reutilizar lo que existe sin ampliar permisos, conservar mappers y vacíos,
y evitar dos definiciones incompatibles del mismo conteo. Cambiar un contrato requiere
actualizar consumidor, documentación y pruebas juntos.
