# Documentación de Arxatec Academy Service

Academy es el backend de formación de Arxatec: catálogo público, lecciones de video y artículo,
cuentas de alumnos, progreso, comentarios y administración editorial. Esta documentación toma
como referencia la organización de [Admin Service](../../../arxatec-admin/arxatec-admin-service/docs/README.md)
y describe los contratos y las limitaciones de la implementación de Academy.

## Guías generales

| Documento                                            | Contenido                                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| [Arquitectura](ARCHITECTURE.md)                      | Arranque, módulos, responsabilidades, persistencia y límites entre slices    |
| [Estilo de código](CODE_STYLING.md)                  | Nombres, TypeScript, imports, validación, respuestas y documentación         |
| [Decisiones](DECISIONS.md)                           | Reglas del producto, alternativas y consecuencias de las decisiones técnicas |
| [Contrato HTTP](API.md)                              | Rutas públicas, de alumno y administrativas; cuerpos, respuestas y errores   |
| [Entorno](ENV.md)                                    | Variables, valores por defecto, dependencias opcionales y semilla            |
| [Rendimiento](PERFORMANCE.md)                        | Consultas, memoria, límites y aspectos que requieren medición                |
| [Pruebas](TESTING.md)                                | Comandos reales, fixtures, PostgreSQL desechable y smoke HTTP                |
| [Despliegue](DEPLOYMENT.md)                          | Instalación, generación de Prisma, migraciones, ejecución y apagado          |
| [Archivos](STORAGE.md)                               | Portadas, recursos y avatares; local y S3/CloudFront firmado                 |
| [Preparación de producción](PRODUCTION_READINESS.md) | Evidencia disponible, comprobaciones pendientes y bloqueos conocidos         |

## Módulos y contratos de producto

El índice de [planificación y alcance](planning/README.md) reúne fuentes Prisma, contratos,
criterios de aceptación y pendientes por área. «Implementado» significa que existe código y una
ruta registrada; la evidencia de ejecución se registra aparte. Crear un documento no completa
una integración ni certifica un despliegue.

| Área          | Alcance y criterios                                                 | Documentación junto al código                                                                                                                    |
| ------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Autenticación | [Registro, sesiones y Google](planning/auth/README.md)              | [auth](../src/modules/auth/docs/README.md)                                                                                                       |
| Cursos        | [Catálogo y edición](planning/courses/README.md)                    | [courses](../src/modules/courses/docs/README.md), [admin_courses](../src/modules/courses/features/admin_courses/docs/README.md)                  |
| Lecciones     | [Contenido, publicación y recursos](planning/lessons/README.md)     | [lessons](../src/modules/courses/features/lessons/docs/README.md), [admin_lessons](../src/modules/courses/features/admin_lessons/docs/README.md) |
| Progreso      | [Inscripción y avance](planning/progress/README.md)                 | [progress](../src/modules/progress/docs/README.md)                                                                                               |
| Comunidad     | [Hilos, reportes y moderación](planning/comments/README.md)         | [comments](../src/modules/comments/docs/README.md), [moderation](../src/modules/comments/features/moderation/docs/README.md)                     |
| Usuarios      | [Perfil, baja y directorio](planning/users/README.md)               | [user](../src/modules/user/docs/README.md), [directory](../src/modules/user/features/directory/docs/README.md)                                   |
| Avisos        | [Suscripciones y pedidos de tema](planning/notifications/README.md) | [notifications](../src/modules/notifications/docs/README.md)                                                                                     |

Consulta también las [definiciones de métricas](planning/metrics/README.md), la
[matriz de acceso](planning/permissions_audit/README.md) y el [registro de entregas](shipped/README.md).
Las rutas, schemas Zod, constantes y migraciones del servicio prevalecen ante una discrepancia.
Los README de cada unidad conservan el porqué detallado; estas guías conectan las piezas sin
depender de documentos de harness que no están incluidos en este repositorio.
