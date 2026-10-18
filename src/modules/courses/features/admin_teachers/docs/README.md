# Docentes del curso

`GET /api/v1/admin/teachers` devuelve `{ teachers }`, ordenado por nombre, y exige sesión y
rol `ADMIN`. Cada registro contiene `id`, `full_name`, `biography` y `photo_url`.

Los perfiles se crean y editan desde el `PATCH /admin/courses/:id` existente. Un docente puede
impartir varios cursos. No hay cuentas de acceso, correos ni permisos propios del docente.
Las pruebas de acceso están en `tests/integration/postgres/admin_access_control.test.ts` y el
recorrido de creación, reutilización, edición y exposición pública en `teachers_flow.test.ts`.
