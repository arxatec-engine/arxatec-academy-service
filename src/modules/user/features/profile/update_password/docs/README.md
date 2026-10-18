# `PATCH /me/password` — el porqué

El bloque *Contraseña* de la pantalla 11. Es casi lo mismo que
`auth/features/password_reset/reset`, con **una diferencia que es todo el punto**.

## 1. El recorrido

```text
PATCH /api/v1/me/password
  → authenticateTokenJwt      sin sesión → 401 UNAUTHENTICATED
  → updatePasswordController  usuario + sesión → parse → service → 200
  → updatePasswordSchema      mínimo 8, y la nueva distinta de la actual
  → updatePasswordService     ¿tiene contraseña? → ¿es la suya? → hash → transacción → aviso
  → 200                       sin data: no cambia nada de lo que la pantalla pinta
```

| Paso | Archivo |
| --- | --- |
| cadena de la ruta | `presentation/update_password.routes.ts:9` |
| usuario → validación → service → respuesta | `presentation/update_password.controller.ts:11-29` |
| reglas | `presentation/update_password.service.ts:26-61` |
| la transacción | `../../../shared/data/user_account.repository.ts:74-91` |

## 2. La diferencia con `password_reset/reset`: **la sesión actual sobrevive**

`consumePasswordReset` revoca **todas** las sesiones del usuario
(`src/modules/auth/features/password_reset/reset/data/reset.repository.ts:46-49`), y tiene que ser
así: quien llega por un enlace de recuperación puede no ser el dueño de las sesiones abiertas, y
la que está usando el enlace todavía no existe.

Aquí la pide alguien que **está dentro** y acaba de escribir su contraseña actual. Echarle de la
pantalla en la que está sería castigar la buena práctica: se revocan todas **menos la suya**
(`revokeOtherUserSessions`, `src/modules/auth/shared/data/sessions.repository.ts:74-84`, con
`id: { not: except_session_id }`). El `session_id` sale del token
(`presentation/update_password.controller.ts:15`), no del cuerpo.

Está comprobado en tres sitios: el test de repositorio de la fachada
(`src/modules/auth/shared/test/sessions_repository.test.ts`), el caso 7 de
`tests/integration/postgres/account_flow.test.ts` —que además cuenta las filas de `auth_sessions`
sin revocar y son **una**— y el recorrido con `curl` de la fase 13.

## 3. Exige la contraseña actual, y por eso el `401` es `INVALID_CREDENTIALS`

Una sesión robada no puede convertirse en una cuenta robada sin saber la contraseña
(`01_reglas_globales.md` §8). La comparación es `verifyPassword`
(`src/infrastructure/password/hash_password.ts:8-21`), la misma de login, sobre el hash que trae
`findUserCredentialsById`. El código de error es el mismo que el de login a propósito: para el
frontend es el mismo caso —*"esa no es tu contraseña"*— y ya sabe pintarlo.

## 4. Tres formas de que no se cambie, en este orden

| Situación | Respuesta | Dónde se decide |
| --- | --- | --- |
| la nueva es igual que la actual | `422` `new_password = user.errors.password_same_as_current` | `domain/update_password.schema.ts:18-26` |
| la cuenta entra con Google (`password_hash` nulo) | `409` `ACCOUNT_USES_GOOGLE` | `presentation/update_password.service.ts:35-41` |
| la actual no es la suya | `401` `INVALID_CREDENTIALS` | `presentation/update_password.service.ts:43-47` |

**La igualdad se comprueba en Zod y no contra el hash.** Las dos cadenas llegan en el mismo cuerpo,
así que compararlas es exacto y gratis; comprobarlo contra el hash costaría un argon2 más para
decir lo mismo. La consecuencia asumida: si alguien manda mal la actual **y** repite ese mismo
valor como nueva, ve el `422` antes que el `401`. Es el orden correcto de todos modos — le está
diciendo que no ha escrito una contraseña nueva.

**El `409` va antes que el `401`** porque a una cuenta de Google no se le puede pedir "la actual":
no tiene ninguna, y responder `401` la mandaría a intentarlo otra vez para siempre.

## 5. El aviso por correo no puede tumbar el cambio

`notifyPasswordChanged` (`presentation/update_password.service.ts:18-24`) envuelve el envío en
`try/catch` y lo degrada a `logger.warn`, igual que `password_reset/reset`. La contraseña **ya
está cambiada** cuando se manda; devolver `500` porque el SMTP está caído haría que el usuario lo
intentara otra vez con una contraseña que ya no es la suya. La plantilla es la de la fase 3
(`src/infrastructure/email/templates/password_changed_email.ts:5-11`), sin cambios: su texto
—*"cerramos las sesiones abiertas"*— sigue siendo cierto para las demás.

## 6. Los tests

- `test/update_password.service.test.ts` — la transacción recibe el `session_id`, el aviso sale al
  correo de la cuenta, el `401` no escribe nada, el `409` no llega ni a comparar, el `404` y el
  correo caído que no deshace nada.
- `test/update_password.controller.test.ts` — el `200` sin `data`, el `payload` exacto con el
  `session_id` de la sesión, los tres `422` (igual, corta, ausente) y el `401` sin Bearer.
