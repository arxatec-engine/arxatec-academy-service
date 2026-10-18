# Exportación de usuarios

`GET /admin/users/export` reutiliza los filtros del directorio y exporta todas las filas que
coinciden, sin paginar, hasta `ADMIN_EXPORT_MAX_ROWS`. Si se supera el máximo devuelve
`EXPORT_TOO_LARGE` en el sobre estándar; en éxito envía CSV UTF-8 con BOM. `src/utils/csv.ts`
escapa comillas/saltos de línea y antepone una comilla simple a valores que Excel pudiera
interpretar como fórmula. El endpoint tiene limitador por admin.

La ruta está montada en `directory.routes.ts`, antes de `/users`, para evitar ambigüedad.
`tests/integration/postgres/admin_users_flow.test.ts` y `src/utils/test/csv.test.ts` cubren
la exportación y la protección de celdas.

Pendiente estructural: el controller de exportación vive en un feature propio, pero la ruta se
registra en el router del directorio; el harness pide un slice por action con README propio.
