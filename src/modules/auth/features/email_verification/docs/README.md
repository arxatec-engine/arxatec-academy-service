# `features/email_verification` — el porqué

Los endpoints **7 y 8** del contrato (`harness/04_contrato_api_auth.md` §4): confirmar el correo
con el token del enlace y volver a mandar ese enlace. Son dos actions porque son dos
responsabilidades (`02_reglas_backend.md` §3): `verify` es **pública y sin sesión**, `resend` es
**autenticada y con cooldown**. Nada de lo que hace una lo necesita la otra.

```text
verify/    POST /api/v1/auth/email/verify    publica   20/h por IP
resend/    POST /api/v1/auth/email/resend    Bearer    45 s entre envios - 5/h por usuario
index.ts   emailVerificationRouter = verifyEmailRouter + resendVerificationRouter
```

## 1. Cómo se monta

`index.ts:6-9` compone un único router con los dos de las actions, y cada action se monta a sí
misma en su path (`verify/presentation/verify.routes.ts:9`,
`resend/presentation/resend.routes.ts:10-15`) leyendo `AuthEndpoints`
(`src/constants/endpoints.ts:16-17`). El router del módulo lo monta con una línea
(`src/modules/auth/index.ts:16`):

```ts
import { emailVerificationRouter } from '@/modules/auth/features/email_verification';

authRouter.use(emailVerificationRouter);
```

Los paths viven en las routes de cada action y no aquí: así el router de la feature no decide
rutas y sigue valiendo si mañana `resend` se mueve de sitio.

## 2. Cada action tiene su repositorio, y es a propósito

`auth_tokens` no tiene repositorio en `modules/auth/shared/data/` (hoy solo hay `users` y
`sessions`). La política de código compartido (`02_reglas_backend.md` §9.1) dice que lo que usa
**una** action se queda en esa action, y aquí las dos consultas no se parecen: `verify` busca
**un** token por su hash y lo consume (`verify/data/verify.repository.ts:16,24`); `resend` busca
**la fecha del último** y rota el vigente (`resend/data/resend.repository.ts:5,15`). Subirlas a
`shared/` habría creado una superficie común para un solo llamador cada una.

Si el slice de recuperación de contraseña acaba necesitando lo mismo sobre `auth_tokens`, ahí sí
se cumple §9.2 y las tres bajan a `modules/auth/shared/data/auth_tokens.repository.ts` — con las
dos actions de esta feature como primer consumidor.

## 3. `EMAIL_ALREADY_VERIFIED`: un código que el contrato pide en un sitio y no en el otro

**Se emite, y desde `src/constants`.** `ErrorCodes.EMAIL_ALREADY_VERIFIED`
(`src/constants/error_codes.ts:7`) es el decimotercer código del catálogo, y lo ponen las dos
ramas idempotentes de la feature:

| Caso | Archivo | Respuesta |
| --- | --- | --- |
| clic dos veces en el enlace de verificación | `verify/presentation/verify.controller.ts:21` | `200` + `meta.code: "EMAIL_ALREADY_VERIFIED"` |
| pedir reenvío con el correo ya verificado | `resend/presentation/resend.controller.ts:30` | `200` + `meta.code` + `data.retry_after_seconds: 0` |

**Por qué existe aunque la tabla §5 del contrato no lo listara al principio.** El §4.7 lo exige
literalmente (*«un correo ya verificado responde `200` con `meta.code:
"EMAIL_ALREADY_VERIFIED"`»*) y el §1 prohíbe ramificar por `description`; sin el código, el
frontend no tenía forma legítima de distinguir "acabo de verificarte" de "ya estabas verificado".
Añadirlo **es un cambio de contrato** (`01_reglas_globales.md` §7, `src/constants/docs/README.md`
§3): la fila está hoy en la tabla §5 de `04_contrato_api_auth.md`.

`HttpResponseMeta.code` está tipado con la unión cerrada de `ErrorCodes`
(`src/utils/build_http_response.ts:5`), así que un código inventado no compila.

El resto del contrato también está: idempotencia real (nunca un error por hacer clic dos veces),
`400 TOKEN_INVALID`, `429 RESEND_COOLDOWN` con `meta.retry_after_seconds` y
`data.retry_after_seconds` en el 200 del reenvío.
