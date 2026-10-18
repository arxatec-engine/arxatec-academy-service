# `PATCH /me/profile` — actualización del nombre

El formulario de perfil permite editar el nombre completo y muestra el correo de solo lectura.
Organización, condición de independiente, ciudad y ciudad escrita ya no se solicitan.

## 1. Contrato y recorrido

```text
PATCH /api/v1/me/profile { full_name }
  → authenticateTokenJwt      sin sesión → 401 UNAUTHENTICATED
  → updateProfileController   usuario autenticado → parse → service
  → updateProfileSchema       nombre recortado, entre 2 y 120 caracteres
  → updateProfileService      UPDATE de full_name
  → 200 { user }              el mismo objeto que GET /auth/me
```

El schema reutiliza únicamente `accountProfileShape.full_name`, de modo que los límites
del nombre siguen siendo los del registro (`domain/update.schema.ts:6-9`). Un nombre ausente,
vacío o fuera de los límites responde `422` con la clave i18n correspondiente a `full_name`.

El controller toma `user_id` de la sesión y solo lee `full_name` del cuerpo
(`presentation/update.controller.ts:11-17`). Los campos adicionales se ignoran, incluidos los
datos retirados del formulario y los campos de cuenta como correo o rol.

## 2. Escritura y respuesta

El service envía al repositorio solo `user_id` y `full_name`
(`presentation/update.service.ts:6-15`). El repositorio actualiza exclusivamente `full_name`
(`../../../shared/data/user_account.repository.ts:53-61`), por lo que guardar el nombre no
sobrescribe otros datos ya existentes en la cuenta.

La respuesta usa `toApiUser`, igual que el resto de las acciones de perfil. El frontend
reemplaza su usuario en memoria con el objeto completo recibido.

## 3. Pruebas

- `test/update.controller.test.ts`: guardado con solo el nombre, trim, límites, campos
  adicionales ignorados y sesión obligatoria.
- `test/update.service.test.ts`: entrada limitada al nombre y respuesta sin contraseña.
- `../../../shared/test/user_account_repository.test.ts`: escritura de una sola columna.
- `tests/integration/postgres/account_flow.test.ts`: guardado real y conservación de los demás
  datos de la cuenta.
