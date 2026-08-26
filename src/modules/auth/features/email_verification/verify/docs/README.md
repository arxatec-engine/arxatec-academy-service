# `verify` — `POST /api/v1/auth/email/verify`

Endpoint **7** del contrato (`harness/04_contrato_api_auth.md` §4.7). Público: el usuario llega
desde el enlace del correo y puede no tener sesión abierta en ese navegador.

## 1. El recorrido

| Paso | Archivo | Qué hace |
| --- | --- | --- |
| Ruta | `presentation/verify.routes.ts:9` | `POST /email/verify` con `emailVerifyRateLimit` (20/h por IP, contrato §6) |
| Validación | `domain/verify.schema.ts:5-10` | `token` obligatorio, recortado, no vacío |
| Controller | `presentation/verify.controller.ts:9-22` | `parse` → service → sobre. Sin `try/catch` |
| Service | `presentation/verify.service.ts:18-43` | hashea, decide, consume |
| Repositorio | `data/verify.repository.ts:16,24` | busca por hash y consume en una transacción |

La respuesta es el sobre de siempre con `200` y **sin `data`**: el contrato §4.7 no define ninguno
y este endpoint no tiene sesión, así que devolver el modelo de usuario entregaría el perfil
completo a cualquiera que tenga el enlace. Lo único que cambia entre los dos caminos felices es
`description` (`verify.controller.ts:16-18`) — y `meta.code`, que hoy falta: ver
`../../docs/README.md` §3.

## 2. La entrada se busca hasheada, nunca en claro

`verify.service.ts:22` llama a `hashOneTimeToken`
(`src/infrastructure/tokens/one_time_token.ts:11`) **antes** de tocar la base: en `auth_tokens`
solo vive el SHA-256 en hexadecimal (`prisma/schema/auth.prisma:22`, `VarChar(64)`), que es la
regla 8.3 de `01_reglas_globales.md`. El test lo fija comprobando que lo que recibe el
repositorio mide 64 caracteres y no contiene el token
(`test/verify.service.test.ts`, «busca el token por su hash SHA-256»).

Por eso el `where` es `findFirst` y no `findUnique` (`data/verify.repository.ts:19-22`):
`token_hash` es único, pero el filtro incluye `type: EMAIL_VERIFICATION` para que un token de
recuperación de contraseña con el mismo hash —imposible, pero gratis de descartar— no pueda
verificar un correo. `findUnique` no admite ese segundo filtro.

## 3. Idempotencia: el orden de los `if` **es** la funcionalidad

`verify.service.ts:24-42`, en este orden exacto:

1. **token desconocido → `400 TOKEN_INVALID`.** Sin fila no hay usuario y no hay nada que decir.
2. **el usuario ya está verificado → `200`,** aunque el token esté consumido o vencido. Ésta es la
   rama que el contrato pide: quien hace clic dos veces en el enlace del correo **no puede ver un
   error**. Si esta comprobación fuera después de `isTokenUsable`, el segundo clic caería en el
   `400` y la pantalla de "enlace caducado" aparecería justo después de haber verificado bien.
3. **token vencido o ya consumido de un correo sin verificar → `400 TOKEN_INVALID`.** Aquí el
   enlace sí está muerto y el frontend tiene que ofrecer pedir otro.
4. **camino feliz → consumir y marcar.**

La caducidad la decide `isTokenUsable` (`src/infrastructure/tokens/one_time_token.ts:24`), que
vence en el instante exacto de `expires_at`; el test lo fija.

`now` entra como parámetro con valor por defecto (`verify.service.ts:20`) para que el test fije el
reloj sin `jest.useFakeTimers`.

## 4. La carrera de los dos clics simultáneos

`consumeEmailVerificationToken` (`data/verify.repository.ts:24-41`) no hace `update`, hace dos
`updateMany` **condicionales** dentro de un `$transaction`:

- el token solo se marca si `consumed_at: null`;
- el usuario solo se marca si `email_verified_at: null`, para no pisar la fecha de una
  verificación anterior (por ejemplo la que deja un reset de contraseña consumido, contrato §4.6).

Devuelve el número de filas de token tocadas, y el service lo lee (`verify.service.ts:42`): si es
`0`, otra petición ganó la carrera entre el `findFirst` y el `updateMany`, así que el resultado
correcto no es un error sino `already_verified: true`. Con un `update` normal, esa carrera
habría sido un `P2025` convertido en `500`.

## 5. Tests

- `test/verify.service.test.ts` — las cuatro ramas, la carrera, el vencimiento en el instante
  exacto y que la búsqueda va hasheada.
- `test/verify.controller.test.ts` — monta el **router real** con Supertest, así que también fija
  el path y la cadena de middlewares. `@/middlewares/rate_limit` va mockeado por su path exacto
  (`02_reglas_backend.md` §10): el limitador real guarda estado en memoria entre tests y haría que
  el resultado dependiera del número de casos.
