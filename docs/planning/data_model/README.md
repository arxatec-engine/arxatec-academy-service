# Modelo de datos y migraciones

**Estado:** esquema dividido por dominio y diez directorios de migración presentes.
[Índice](../README.md) · [Arquitectura](../../ARCHITECTURE.md).
Este documento describe el esquema del árbol de trabajo, no el estado aplicado en una base.

## Cliente, propiedad y generación

[prisma.config.ts](../../../prisma.config.ts) selecciona `prisma/schema`,
`prisma/migrations` y el seed. [_base.prisma](../../../prisma/schema/_base.prisma) genera
el cliente en `src/generated` con formato CommonJS. `pnpm prisma:generate` prepara ese cliente;
`pnpm build` no lo genera. Prisma CLI, cliente y adaptador son dependencias del mismo servicio.

La conexión viene de `DATABASE_URL`. Aplicación e integración usan el mismo módulo de cliente;
el aislamiento de tests debe establecerse antes de importarlo. No hay segundo cliente lector,
tablas de Admin ni migraciones sobre Lawyer.

## Tablas e invariantes

| Tabla                  | Unicidad y relaciones                                     | Semántica relevante                                                       |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------- |
| `users`                | Email único; id cuid                                      | Roles STUDENT/ADMIN; hash nullable en cuenta Google                       |
| `auth_sessions`        | Id de sesión, índices por usuario y vencimiento           | Ventana deslizante y revocación; conserva IP/user agent                   |
| `auth_tokens`          | `token_hash` único, índice usuario/tipo                   | Verificación, reset y canje; caducidad y consumo                          |
| `oauth_accounts`       | Proveedor + id externo únicos                             | Vincula identidad Google a cuenta Academy                                 |
| `courses`              | Slug único; índices estado/orden, tema y nivel            | Borrador/publicado/archivado; primera publicación bloquea slug en service |
| `lessons`              | Curso + slug y curso + posición únicos                    | ARTICLE/VIDEO; publicación y muestra gratuita                             |
| `lesson_resources`     | Lección + posición única                                  | URL, clave opcional, MIME y bytes                                         |
| `enrollments`          | Usuario + curso únicos                                    | Inicio, primer cierre vigente y última lección referenciada               |
| `lesson_progress`      | Usuario + lección únicos                                  | Posición máxima guardada y marca de completado                            |
| `comments`             | Índices lección/estado/fecha, padre, usuario y moderación | Raíz/respuesta; estados visibles, ocultos y borrados                      |
| `comment_reports`      | Comentario + reportante únicos                            | Motivo y revisión con actor/fecha                                         |
| `notification_signups` | Email + curso únicos y parcial para curso NULL            | Avisos por curso o catálogo general                                       |
| `topic_requests`       | Email + término normalizado únicos                        | Cuenta solicitudes repetidas y última fecha                               |

La unicidad de un solo nivel de respuesta, la validez del contenido y las transiciones
editoriales se validan en la aplicación; no todo lo que el service exige es un CHECK de SQL.
Los IDs son cuid de Prisma salvo fixtures creadas expresamente; los schemas de rutas suelen
validar string no vacío, no UUID. No trasladar validadores de UUID de Admin.

## Cascadas y baja de cuenta

Borrar un usuario elimina sesiones, tokens, OAuth, inscripciones, progreso, reportes propios y
avisos/temas asociados mediante relaciones Cascade. La relación de autor de comentario usa
SetNull para un borrado directo del usuario, al igual que referencias opcionales de moderadores.

El endpoint `DELETE /me` hace más que esa cascada: su transacción invoca
`deleteUserComments`, que borra físicamente los comentarios propios y sus reportes antes de
borrar el usuario. La relación de respuestas tiene Cascade, por lo que borrar una raíz puede
retirar respuestas de otros autores. No documentar la baja HTTP como simple anonimización.
Ver [repositorio de cuenta](../../../src/modules/user/shared/data/user_account.repository.ts)
y [repositorio de comentarios](../../../src/modules/comments/shared/data/comments.repository.ts).

Borrar una lección elimina recursos, progreso y comentarios; `last_lesson_id` en inscripciones
queda null. Archivar un curso no lo borra. El endpoint administrativo de baja de lección exige
borrador y confirmación cuando hay datos de alumnos. Las claves de objetos requieren limpieza
externa a la cascada SQL y comprobación de referencias compartidas.

## Historial de migraciones

| Migración                               | Cambio                                             |
| --------------------------------------- | -------------------------------------------------- |
| `20260820203635_init`                   | Usuarios y autenticación                           |
| `20260821172841_modelo_de_contenido`    | Cursos, lecciones y recursos                       |
| `20260821205134_progreso`               | Inscripciones y progreso                           |
| `20260821213652_comentarios`            | Comentarios y reportes                             |
| `20260821221319_perfil`                 | Clave de avatar                                    |
| `20260924174500_course_cover_key`       | Clave de portada                                   |
| `20260924180000_resource_file_key`      | Clave de recurso                                   |
| `20260924181500_comment_moderation`     | Estado de revisión, fechas y actores de moderación |
| `20260924183000_notifications`          | Avisos, temas e índice parcial de catálogo         |
| `20260924190000_youtube_video_provider` | Proveedor YOUTUBE                                  |

El índice parcial `notification_signups_email_catalog_key` existe en SQL para
`course_id IS NULL`; el índice compuesto no deduplica ese null en PostgreSQL por sí solo.
Conservar esa migración aunque el schema Prisma no represente toda su expresión.

## Verificación y evolución

Generar cliente tras cambios de schema y aplicar migraciones versionadas en una base
desechable antes de integración. Desarrollo usa `migrate dev`; despliegue usa `migrate deploy`.
No reemplazar el historial por `db push/reset` ni editar una migración aplicada para corregir
datos de producción.

Probar unicidad concurrente, consumo de tokens, máximo de progreso, orden, cascadas y
referencias de recursos con PostgreSQL real. Una comparación de objetos mockeados no prueba
índices ni transacciones. Una futura política de conservación de comentarios deberá decidir
explícitamente entre baja física y anonimización antes de cambiar los contratos existentes.
