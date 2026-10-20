# Alcance y planificación de Academy Service

**Estado:** los seis módulos de negocio tienen implementación y rutas registradas. Este espacio
retiene las reglas, fuentes, contratos y criterios de aceptación, con pendientes explícitos.
«Implementado» describe el árbol de código inspeccionado; [producción](../PRODUCTION_READINESS.md)
y [entrega](delivery/README.md) distinguen la evidencia de ejecución y el trabajo operativo.

Academy conserva su PostgreSQL para identidad, sesiones, catálogo, aprendizaje, comunidad y avisos.
El panel editorial es parte de este servicio y utiliza usuarios ADMIN de Academy. No consume
la cookie de Admin ni consulta una base Lawyer para estas pantallas.

## Áreas implementadas

| Área de código                      | Superficie principal bajo `/api/v1`                                    | Alcance documentado                                                 |
| ----------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `auth`                              | `/auth`                                                                | [Registro, sesión, verificación, reset y Google](auth/README.md)    |
| `courses/catalog`                   | `/courses`                                                             | [Catálogo, facetas, ficha y edición de cursos](courses/README.md)   |
| `courses/lessons` y `admin_lessons` | `/courses/:course_slug/lessons/:lesson_slug`, `/admin/lessons`         | [Acceso, artículos, videos y recursos](lessons/README.md)           |
| `progress`                          | `/courses/:slug/enroll`, `/lessons/:lesson_id/progress`, `/me/courses` | [Inscripción, avance y finalización](progress/README.md)            |
| `comments`                          | `/lessons/:lesson_id/comments`, `/comments`, `/admin/comments`         | [Hilos, reportes y moderación](comments/README.md)                  |
| `user`                              | `/me`, `/admin/users`                                                  | [Perfil, cuenta, resumen y directorio/exportación](users/README.md) |
| `notifications`                     | `/notifications`, `/admin/notifications`                               | [Avisos y demanda de temas](notifications/README.md)                |

Cada área enlaza schemas y repositorios reales. Las rutas editoriales de cursos y lecciones
viven dentro de `courses`; no son un séptimo servicio ni requieren otro actor de Admin.

## Contratos transversales

- [Datos y migraciones](data_model/README.md): relaciones, unicidad, cascadas y clientes.
- [Contratos HTTP](http_contracts/README.md): convenciones, paginaciones, ejemplos y errores.
- [Métricas](metrics/README.md): totales, fechas, estado actual y cobertura.
- [Permisos y trazabilidad](permissions_audit/README.md): identidad real, campos permitidos y límites.
- [Archivos](storage/README.md): local, S3/CloudFront firmado, limpieza y validación operativa.
- [Reutilización de endpoints](endpoint_reuse/README.md): qué comparten alumno, catálogo y panel.
- [Entrega y verificación](delivery/README.md): dependencias, fixtures y cierre de pendientes.

## Fuentes de persistencia

| Schema                                                    | Datos propios de Academy                            |
| --------------------------------------------------------- | --------------------------------------------------- |
| [users](../../prisma/schema/users.prisma)                 | Perfil, rol, credencial, verificación y avatar      |
| [auth](../../prisma/schema/auth.prisma)                   | Sesiones, tokens de un solo uso y cuentas OAuth     |
| [courses](../../prisma/schema/courses.prisma)             | Cursos, lecciones y metadatos de recursos           |
| [progress](../../prisma/schema/progress.prisma)           | Inscripciones y progreso por lección                |
| [comments](../../prisma/schema/comments.prisma)           | Hilos, reportes y actores de moderación             |
| [notifications](../../prisma/schema/notifications.prisma) | Avisos y pedidos de tema                            |
| [enums](../../prisma/schema/enums.prisma)                 | Vocabulario de roles, ciudades, contenido y estados |

El inventario muestra qué se puede consultar, no cuántas personas usan la aplicación ni el estado
de una base remota. Un campo disponible en Prisma no forma parte automáticamente de la API.

## Organización y recursos

Aplicar [arquitectura](../ARCHITECTURE.md) y [estilo](../CODE_STYLING.md): controller para HTTP,
service para reglas, repository para persistencia y `shared` como superficie entre módulos.
Las features administrativas agrupadas conservan deuda de separación por acción.

No añadir módulos de workspaces, facturación, IA o métricas de Lawyer por copiar el índice de
Admin. Sus objetivos se reemplazan aquí por aprendizaje y edición. También cambian las
decisiones de recursos: Academy aún no configura un pool ni una cola Argon2 acotados.
Las búsquedas y exportaciones que materializan datos se identifican en
[rendimiento](../PERFORMANCE.md), sin atribuirles optimizaciones que no existen.

## Pendientes fuera del alcance implementado

S3, descargas privadas, correo masivo, capacidades granulares, auditoría general, recibos de
comandos y métricas de retención/presencia no tienen un contrato operativo implementado. Cada
incorporación requiere datos, permisos, pruebas y coordinación con el frontend. No se deben
presentar como funcionalidades disponibles por aparecer en una hoja de ruta.
