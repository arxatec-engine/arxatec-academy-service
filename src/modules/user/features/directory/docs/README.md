# Directorio administrativo

`GET /admin/users` requiere `ADMIN` y combina filtros, búsqueda normalizada, paginación y
estadísticas de inscripción/progreso. Las consultas viven en
`shared/data/directory.repository.ts`; su proyección excluye `password_hash`, tokens y sesiones.
El mismo esquema de filtros alimenta el CSV de `directory_export`, para que listado y descarga
no diverjan. Las fechas de reporte usan `REPORTING_UTC_OFFSET_MINUTES` (Lima por defecto).

`tests/integration/postgres/admin_users_flow.test.ts` cubre acceso y filtros. El smoke consulta
al alumno temporal y abre el CSV antes de darlo de baja.

Pendiente estructural: separar acciones y añadir README por action.
