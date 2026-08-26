# `password_reset` — el porqué de la feature

Dos actions que forman **un solo flujo del producto** y por eso comparten feature:

| Action | Endpoint | Auth | README |
| --- | --- | --- | --- |
| `request` | `POST /auth/password/forgot` | pública | `request/docs/README.md` |
| `reset` | `POST /auth/password/reset` | pública | `reset/docs/README.md` |

`index.ts` compone los dos routers (`index.ts:8-9`) y el módulo monta el resultado con
`authRouter.use(passwordResetRouter)` (`src/modules/auth/index.ts:15`). Cada router declara su
propio path desde `AuthEndpoints` y su propio limitador, así que la composición no añade prefijo
ni middleware.

## 1. Lo que une a las dos actions: el token

El mismo `auth_tokens.type = PASSWORD_RESET` viaja de una a otra. Las dos reglas que sostienen el
flujo viven una en cada lado y hay que leerlas juntas:

- **`request` guarda solo el SHA-256** (`request/data/request.repository.ts:47-55`) y manda el
  token en claro únicamente por correo. Si se filtra la base, el enlace no sirve
  (`01_reglas_globales.md` §8.3).
- **`reset` busca por ese mismo hash** (`reset/presentation/reset.service.ts:32`) y lo consume con
  un compare-and-set dentro de una transacción (`reset/data/reset.repository.ts:28-52`). Un token
  ya consumido, vencido o inexistente da el mismo `400 TOKEN_INVALID`.

`request` invalida los tokens anteriores del usuario marcándoles `consumed_at` con la misma fecha
con la que emite el nuevo, dentro de la misma transacción. Efecto: **pedir el enlace dos veces deja
vivo solo el último**, que es lo que espera cualquiera que pide otro correo porque el primero no
llegó.

## 2. Las dos respuestas son deliberadamente sosas

`forgot` responde `200` con el mismo texto y un suelo de tiempo de 400 ms
(`AuthPolicy.password_forgot_min_response_ms`, `src/constants/auth.ts:12`) exista o no el correo:
sin eso, el endpoint sería un oráculo que dice qué correos están registrados
(contrato §4.5, `01_reglas_globales.md` §8.2). `reset` responde `200` sin `data`.

## 3. Lo que el reset arrastra consigo

Al consumirse el token, en la **misma transacción**: se marca el token, se cambia el hash, se marca
el correo como verificado si no lo estaba, y se **revocan todas las sesiones del usuario**
(`reset/data/reset.repository.ts:46-49`). Lo último no es un extra: cambiar la contraseña sin
cerrar sesiones deja dentro a quien ya estaba (`01_reglas_globales.md` §8.4). El correo de aviso se
manda después y su fallo **no** deshace nada (`reset/presentation/reset.service.ts:22-28`).

`tests/integration/postgres/auth_flow.test.ts` (casos 11 y 12) es lo que fija esa cascada contra
PostgreSQL real: cuenta las sesiones activas antes y después del reset, y comprueba que el token de
la sesión anterior ya no sirve para `GET /auth/me`.

## 4. Una cuenta de Google también recibe el enlace

El contrato reserva `ACCOUNT_USES_GOOGLE` para el login (§4.2) y no dice nada de este flujo, así
que aquí **no hay rama por proveedor**: introducirla sería otro canal para distinguir cuentas, justo
lo que el §4.5 evita. La consecuencia querida es que una cuenta creada con Google puede fijarse una
contraseña con este enlace y a partir de ahí entrar por los dos caminos; `reset` no comprueba
`auth_provider` (`reset/presentation/reset.service.ts:30-52`).
