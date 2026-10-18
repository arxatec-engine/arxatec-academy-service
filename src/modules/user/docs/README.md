# `modules/user` — el porqué

La pantalla 11 entera: el alumno cambia sus datos, su contraseña y su foto — y puede irse.

```text
src/routes/index.ts:16        routes.use(ApiPrefix, userRouter)
index.ts:9                    userRouter.use(MeRoutePrefix, profileRouter)
index.ts:10                   userRouter.use(MeRoutePrefix, accountRouter)
```

| Método | Ruta | Auth | Slice |
| --- | --- | --- | --- |
| `PATCH` | `/api/v1/me/profile` | Bearer | `profile/update` |
| `PATCH` | `/api/v1/me/password` | Bearer | `profile/update_password` |
| `PUT` | `/api/v1/me/avatar` | Bearer + multipart | `profile/update_avatar` |
| `DELETE` | `/api/v1/me/avatar` | Bearer | `profile/delete_avatar` |
| `DELETE` | `/api/v1/me` | Bearer | `account/delete` |
| `GET` | `/api/v1/me/summary` | Bearer | `account/get_summary` |

**Para leer el perfil no hay nada aquí**: ya está `GET /auth/me`
(`src/modules/auth/features/session/get_me/`). Duplicarlo sería tener dos sitios donde mantener
la misma forma, y las cuatro respuestas de este módulo que devuelven usuario usan **el mismo
mapper** (`toApiUser`, `src/modules/auth/shared/domain/user_mapper.ts:3-16`).

## 1. Comparte `/me` con `modules/progress` y no chocan

`progressRouter` va antes (`src/routes/index.ts:14`) y bajo `/me` solo declara `/courses`
(`src/modules/progress/index.ts:12`). Ninguna de las seis rutas de aquí casa con eso: cuatro
tienen otro segmento (`/profile`, `/password`, `/avatar`, `/summary`) y la quinta es `/` a secas.
Comprobado con `curl` contra el servidor arrancado (`GET /api/v1/me/courses` sigue respondiendo
lo suyo) y en `tests/integration/postgres/account_flow.test.ts`.

## 2. Este módulo **no** duplica auth: lo reutiliza

| Qué | De dónde |
| --- | --- |
| hasheo y verificación de contraseñas | `src/infrastructure/password/hash_password.ts:5-21` |
| revocación de sesiones | `revokeOtherUserSessions`, `src/modules/auth/shared/data/sessions.repository.ts:74-84` |
| borrado de sesiones, tokens y cuentas OAuth | `src/modules/auth/shared/data/auth_artifacts.repository.ts:4-11` |
| forma del usuario en la API | `src/modules/auth/shared/domain/user_mapper.ts:3-16` |
| validación del nombre del perfil | `accountProfileShape.full_name`, `src/modules/auth/shared/domain/account_fields.schema.ts:12-17` |
| plantilla del aviso de cambio de contraseña | `src/infrastructure/email/templates/password_changed_email.ts:5-11` |

El perfil reutiliza la validación del nombre de `modules/auth/shared/domain/`
(`features/profile/update/domain/update.schema.ts:6-9`). La actualización acepta solo
`full_name`; organización, condición de independiente y ciudad ya no forman parte del
formulario ni del contrato de escritura.

## 3. La frontera con `progress` y con `comments`, para la baja de cuenta

La baja borra filas de tablas que **no son de este módulo**. No las toca por su cuenta: se las
pide a la fachada de cada uno, y por eso las tres funciones de borrado aceptan el cliente de la
transacción como segundo parámetro.

| Tabla | Quién la borra | Fachada |
| --- | --- | --- |
| `lesson_progress`, `enrollments` | `modules/progress` | `deleteUserProgress`, `src/modules/progress/shared/data/progress.repository.ts:197-203` |
| `comment_reports`, `comments` | `modules/comments` | `deleteUserComments`, `src/modules/comments/shared/data/comments.repository.ts:79-85` |
| `auth_sessions`, `auth_tokens`, `oauth_accounts` | `modules/auth` | `deleteUserAuthArtifacts`, `src/modules/auth/shared/data/auth_artifacts.repository.ts:4-11` |
| `users` | este módulo | `shared/data/user_account.repository.ts:93-101` |

`countCompletedEnrollments` (`progress.repository.ts:194-195`) es la otra fachada que se amplió,
para el pie de la pantalla. `pnpm boundaries` verifica que aquí no entre ningún `data/` privado, y
no hay baseline.

## 4. `avatar_key`: por qué hay una columna nueva

`avatar_url` guarda **una URL pública**, y el `StoragePort` borra **por clave**
(`remove(key)`, `src/infrastructure/storage/storage.types.ts:16-20`). Deducir la clave de la URL
recortando el prefijo funcionaría hasta el primer avatar que **no** esté en nuestro
almacenamiento: una cuenta de Google llega con
`https://lh3.googleusercontent.com/…` en `avatar_url`
(`src/modules/auth/features/google_login/callback/presentation/callback.service.ts:65`), y sobre
esa cadena el recorte produce basura que el adaptador local rechazaría —o, con otro adaptador,
podría borrar cualquier cosa—.

Con `avatar_key` (`prisma/schema/users.prisma:12`, migración `20260821221319_perfil`) la pregunta
"¿esto es un archivo nuestro?" es una columna: si es `null`, no hay nada que borrar. La foto de
Google se sigue viendo y **no se intenta borrar**, que es exactamente lo correcto.

`avatar_key` **no sale por la API**: `USER_PROFILE_SELECT`
(`shared/data/user_account.repository.ts:17-30`) no la pide, igual que no pide `password_hash`.

## 5. Qué comparte el módulo

| Pieza | Dónde | Quién la usa |
| --- | --- | --- |
| todo el acceso a `users` | `shared/data/user_account.repository.ts` | los seis slices |
| borrar un archivo sin poder fallar | `shared/data/avatar_storage.ts:5-15` | subir, quitar y borrar cuenta |
| el `404` de un usuario que ya no está | `shared/domain/user_not_found.ts:6-9` | contraseña, avatar, baja y resumen |
| formas de la fila y de la entrada | `shared/domain/user_account.types.ts` | todos |

**No hay `shared/policy/`**: la validación del nombre y la de archivos ya viven en
`modules/auth/shared/domain` y en `infrastructure/storage`; no necesitan otra envoltura aquí.

## 6. Lo que este módulo deja abierto

- **El correo no se puede cambiar.** La pantalla dice *"escríbenos a hola@arxatec.pe"*. Cuando se
  pueda, será un slice aparte con verificación del correo nuevo, no un campo de `PATCH /profile`.
- **`PATCH /me/password` no tiene rate limit.** Exige la contraseña actual, así que es un oráculo
  para quien ya tenga una sesión robada. El brief solo obliga a limitar login, registro,
  verificación y recuperación (`01_reglas_globales.md` §8.5). Si se añade, el sitio es
  `middlewares/rate_limit.ts` con `userKey`.
- **La baja no manda correo de despedida.** No hay plantilla y el brief no la pide.
- **No hay descarga de datos antes de irse.** La pantalla no la ofrece.
