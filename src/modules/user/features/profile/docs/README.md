# `features/profile` — el porqué

Las cuatro acciones del formulario de la pantalla 11: los datos, la contraseña y la foto (poner y
quitar). Se montan las cuatro bajo `/me` desde `index.ts:10-13`.

| Método | Ruta | Action | Respuesta |
| --- | --- | --- | --- |
| `PATCH` | `/me/profile` | `update` | `200 { user }` |
| `PATCH` | `/me/password` | `update_password` | `200` sin `data` |
| `PUT` | `/me/avatar` | `update_avatar` | `200 { user }` |
| `DELETE` | `/me/avatar` | `delete_avatar` | `200 { user }` |

## 1. Tres de las cuatro devuelven `{ user }`, y es el mismo objeto que `GET /auth/me`

El frontend tiene el usuario en memoria desde que entra. Si una acción del perfil respondiera solo
`204`, la pantalla tendría que **volver a pedir** `/auth/me` para pintarse, o —peor— parchear su
copia local con lo que ella cree que mandó. Devolver el usuario entero, con el mismo mapper
(`toApiUser`, `src/modules/auth/shared/domain/user_mapper.ts:3-16`), convierte cada guardado en
una fuente de verdad completa.

La excepción es la contraseña: **no cambia nada de lo que se pinta**, así que su respuesta no
lleva `data`.

## 2. Ninguna de las cuatro exige el correo verificado

`requireVerifiedEmail` (`src/middlewares/require_verified_email.ts:5-13`) está montado solo en las
rutas de escribir comentarios (D-006 y `src/middlewares/docs/README.md` §11). Aquí no: alguien que
se acaba de registrar y todavía no abrió su correo tiene que poder **corregir su nombre** y
**cambiar su contraseña**. Bloquear el perfil por un correo sin verificar convertiría un aviso en
un muro, y la cuenta ya existe.

## 3. Cuatro slices y no dos

`update_avatar` y `delete_avatar` comparten ruta y modelo mental, pero no comparten nada de su
recorrido: uno lleva multipart, multer, validación por bytes y dos escrituras; el otro es una
línea de `UPDATE`. Meterlos en un slice sería un `if (req.file)` en un service, que es exactamente
lo que prohíbe *"una action, una responsabilidad"*. Lo que sí comparten está en
`../../shared/data/avatar_storage.ts:5-15`.
