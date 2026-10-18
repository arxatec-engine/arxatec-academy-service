# Usuarios: perfil, cuenta y directorio administrativo

**Estado:** implementado. [Perfil y cuenta](../../../src/modules/user/docs/README.md) ·
[Directorio](../../../src/modules/user/features/directory/docs/README.md) ·
[CSV](../../../src/modules/user/features/directory_export/docs/README.md) · [Índice](../README.md).

## Cuenta del alumno

Las rutas `/me` requieren sesión activa y operan exclusivamente sobre el usuario autenticado.
El controller no acepta otra identidad desde query/body. La lectura actual se hace mediante
`GET /auth/me`; no existe un `GET /me/profile` registrado. El DTO de perfil reutiliza el usuario
público de auth y excluye credenciales y claves de almacenamiento.

| Ruta bajo `/api/v1`  | Entrada                           | Resultado                                |
| -------------------- | --------------------------------- | ---------------------------------------- |
| `PATCH /me/profile`  | full_name, city y perfil opcional | 200 con user                             |
| `PATCH /me/password` | current_password y new_password   | 200 con revoked_sessions                 |
| `PUT /me/avatar`     | Multipart file                    | 200 con user                             |
| `DELETE /me/avatar`  | —                                 | 200 con user y avatar null               |
| `GET /me/summary`    | —                                 | 200 con member_since y completed_courses |
| `DELETE /me`         | password si tiene hash            | 204, sin body                            |

PATCH de perfil no es un merge de todos los campos: full_name y city siguen siendo requeridos.
Nombre 2–120; organización hasta 160; city LIMA/AREQUIPA/TRUJILLO/OTHER y texto other hasta 80
obligatorio con OTHER. is_independent tiene default false y la normalización de campos se hace
en el dominio. Correo, rol y verificación no se editan por esta ruta.

Cambio de contraseña requiere contraseña actual y nueva distinta de 8–128 caracteres. Escribe
hash y revoca las otras sesiones en una transacción, conservando la actual. Una cuenta Google
sin hash devuelve 409 ACCOUNT_USES_GOOGLE; contraseña actual incorrecta, 401 INVALID_CREDENTIALS.
El fallo del correo de aviso no revierte el cambio.

Avatar acepta JPEG/PNG hasta 2 MiB, con comprobación de firma. Subir reemplaza la referencia y
limpia el anterior; quitar es repetible mientras el usuario exista. La limpieza fallida se
registra sin deshacer la actualización que ya se completó.

## Baja y conservación

Con hash persistido, DELETE exige comprobar password; una cuenta sin hash no la necesita.
La transacción borra progreso, comentarios propios, reportes propios y artefactos de auth, y
después usuario. Las cascadas retiran avisos/temas vinculados. Al borrar una raíz propia pueden
desaparecer respuestas ajenas por la relación padre. El avatar se intenta retirar después.

La FK SetNull del autor no significa que el endpoint preserve comentarios: hay una limpieza
explícita anterior al borrado del usuario. Una eliminación directa de base tiene otra semántica.
No ofrecer baja como operación reversible ni como mera desactivación del perfil.

## Directorio administrativo y filtros

`GET /admin/users` exige ADMIN y devuelve `data: { users, stats }` y `meta.pagination`.
Cada fila incluye id, nombre, correo, organización, independencia, ciudad, fechas de creación/
verificación y completed_courses. No incluye hash, sesiones, tokens, IP ni claves de avatar.

| Parámetro                                       | Contrato                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| search                                          | Trim, máximo 120; nombre/correo/organización sin acentos ni mayúsculas   |
| city                                            | Varios enums, repetidos o por coma                                       |
| registered_from / registered_to                 | Fechas YYYY-MM-DD; desde inclusive y hasta inclusive como día de reporte |
| is_independent / email_verified / has_completed | Texto literal true/false                                                 |
| completed_topic                                 | Varios temas; inscripción con fecha de cierre en alguno de ellos         |
| sort                                            | created_at (desc por defecto) o full_name (asc), con id de desempate     |
| page / per_page                                 | Desde 1; 25 por defecto y máximo 100                                     |

Los filtros de cierre usan `enrollments.completed_at IS NOT NULL`, no recalculan el temario
actual. `has_completed` y `completed_topic` se combinan con AND. Stats devuelve
total_registered, registered_this_week y week_start globales, independientemente de los filtros.
La semana empieza lunes según `REPORTING_UTC_OFFSET_MINUTES`, -300 por defecto.

## CSV y consultas

`GET /admin/users/export` comparte filtros, omite paginación y ordena como el directorio. Exporta
nombre, correo, afiliación, ciudad, fecha de registro y cursos terminados, con fechas del reporte.
Devuelve CSV UTF-8 con BOM, Content-Disposition y Cache-Control no-store. Celdas con prefijos
de fórmula se neutralizan mediante la utilidad CSV.

El límite es 5 exportaciones/h por ADMIN. Más de ADMIN_EXPORT_MAX_ROWS devuelve
422 EXPORT_TOO_LARGE con row_count/max_rows; no ofrece una descarga truncada silenciosa.
El archivo se construye en memoria, no mediante streaming. La búsqueda también materializa
candidatos de usuarios; [rendimiento](../../PERFORMANCE.md) identifica su coste.

## Aceptación y límites

[account_flow](../../../tests/integration/postgres/account_flow.test.ts) verifica los comandos
personales y [admin_users_flow](../../../tests/integration/postgres/admin_users_flow.test.ts)
directorio/exportación. Comprobar denegación a otro actor, ausencia de secretos, límite de filas,
fecha de reporte y persistencia de revocación. El resumen personal cuenta cierres persistidos,
por lo que puede diferir de cursos al día; no representa presencia ni tiempo estudiado.

No existen en este directorio edición ajena, cambio de rol por API, suspensión, revocación
administrativa de sesiones ni acceso a otras bases. Añadir esos comandos exige definir permiso,
trazabilidad y contrato; un botón de frontend no es autorización.
