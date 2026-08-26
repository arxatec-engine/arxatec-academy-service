# `auth/password_reset/reset` — el porqué

Endpoint 6 del contrato: `POST /api/v1/auth/password/reset`
(`04_contrato_api_auth.md` §4.6). Cambia la contraseña con el token que viajó en el correo de
recuperación que emite el slice hermano `password_reset/request`.

## 1. El recorrido, de la petición a la respuesta

| Paso | Archivo | Qué hace |
| --- | --- | --- |
| Entrada | `presentation/reset.routes.ts:9-13` | `POST /password/reset` con `passwordResetRateLimit` delante (20/hora por IP) |
| Validación | `presentation/reset.controller.ts:10` | `resetPasswordSchema.parse(req.body)` — **antes** de tocar nada |
| Reglas | `presentation/reset.service.ts:30-53` | busca el token por su hash, comprueba que sirve, hashea la contraseña, consume y avisa |
| Persistencia | `data/reset.repository.ts:17-52` | lectura con `select` explícito + la transacción de consumo |
| Respuesta | `presentation/reset.controller.ts:14-20` | `200` con el sobre de `buildHttpResponse`, **sin `data`** |

La ruta es pública: quien tiene el token no tiene sesión (la acaba de perder, por eso pidió el
enlace). Por eso aquí no hay `authenticateTokenJwt`, y por eso el rate limit es por IP y no por
usuario.

## 2. Entrada: qué se valida y por qué así

`domain/reset.schema.ts:6-15` acepta exactamente dos campos, `token` y `password`. Zod descarta
en silencio cualquier otra clave del cuerpo, así que un `{"role":"ADMIN"}` colado en la petición
no llega ni al service (lo fija `test/reset.controller.test.ts` en «pasa al service solo el token
recortado y la contraseña»).

Tres decisiones que no se ven en el código:

1. **`token` se recorta (`.trim()`, `reset.schema.ts:9`) y `password` no.** Un token copiado de
   un correo arrastra espacios y saltos de línea; recortarlo evita un `TOKEN_INVALID` que el
   usuario no puede entender ni corregir. Recortar la contraseña sería lo contrario: cambiaría en
   silencio lo que la persona escribió, y al siguiente ingreso no entraría.
2. **Los mensajes son claves i18n, no prosa** (`ValidationKeys`, `src/constants/validation_keys.ts:1-52`).
   El manejador global copia `issue.message` a `meta.fields` solo si tiene forma de clave y si no
   lo sustituye por `errors.validation.invalid`
   (`src/middlewares/error_handler.ts:43`): escribir aquí un texto en español degradaría el error
   del frontend a genérico sin que nada se pusiera rojo.
3. **El mínimo de 8 sale de `AuthPolicy.password_min_length`** (`src/constants/auth.ts:12`), no de
   un `8` escrito aquí. El día que la política cambie, cambia en un sitio y este slice, el de
   registro y el frontend se mueven juntos.

## 3. Por qué los tres fallos del token devuelven **el mismo** error

Inválido, caducado y ya consumido salen todos como `400 TOKEN_INVALID`
(`presentation/reset.service.ts:17-20,34-36,48-50`), con el mismo texto
(`AuthMessages.password_reset.token_invalid`).

Distinguirlos sería regalarle al atacante el estado del token: «caducado» y «ya usado» confirman
que **ese token existió**, y con ello que existe la cuenta y que alguien pidió el enlace. La
misma razón por la que el login no distingue correo inexistente de contraseña incorrecta
(`04_contrato_api_auth.md` §4.2). El frontend no pierde nada: el contrato §5 le manda pintar la
misma pantalla de «enlace caducado» con la acción de pedir otro, sea cual sea el motivo.

## 4. El token nunca se busca en claro

La base guarda **solo** el SHA-256 en hexadecimal (`prisma/schema/auth.prisma:22`,
`token_hash VarChar(64)`). El service consulta con `hashOneTimeToken(payload.token)`
(`presentation/reset.service.ts:32`, hash en `src/infrastructure/tokens/one_time_token.ts:11-12`).

Si se filtra la base, los `token_hash` que contiene no sirven para restablecer nada. El test
«busca el token por su hash SHA-256 y nunca por el valor en claro» fija esta propiedad, porque es
exactamente el tipo de cosa que una refactorización deshace sin darse cuenta.

`isTokenUsable` (`src/infrastructure/tokens/one_time_token.ts:24-27`) exige `consumed_at === null`
y `expires_at` en el futuro. El TTL de 1 hora no se comprueba aquí: lo grabó quien creó el token
(`AuthTokenTtlSeconds.password_reset`, `src/constants/auth.ts:5`), y este slice solo lee la fecha.

## 5. La transacción: por qué las cuatro escrituras van juntas

`data/reset.repository.ts:28-52` mete en **una** transacción:

1. marcar `consumed_at` en el token,
2. escribir el `password_hash` nuevo,
3. marcar el correo verificado si no lo estaba,
4. revocar **todas** las sesiones del usuario.

Partirlas deja estados que un módulo de auth no se puede permitir: contraseña cambiada con el
token todavía usable, o contraseña cambiada con las sesiones del atacante vivas
(`01_reglas_globales.md` §8.4).

**El token se consume primero, y con `updateMany … where consumed_at: null`**
(`data/reset.repository.ts:29-32`). No es un `update` normal por dos razones: es un
*compare-and-set* atómico —dos peticiones con el mismo token en paralelo, y solo una ve
`count === 1`; la otra recibe `count === 0`, aborta y su llamador devuelve `TOKEN_INVALID`
(`presentation/reset.service.ts:48-50`)— y evita depender de la lectura del paso anterior, que ya
es información vieja cuando llega aquí.

**Por qué no se reutiliza `revokeAllUserSessions`** de
`src/modules/auth/shared/data/sessions.repository.ts:86-96`, que hace exactamente ese
`updateMany`: esa función habla con el cliente global `prisma`, no con el `tx` de la transacción,
así que llamarla desde dentro dejaría la revocación **fuera** del ámbito transaccional — es decir,
funcionaría en las pruebas y perdería la atomicidad justo cuando importa. La duplicación de tres
líneas es el precio de esa garantía.

**Por qué la contraseña se hashea antes de abrir la transacción**
(`presentation/reset.service.ts:38`): argon2id tarda del orden de decenas de milisegundos a
propósito. Hacerlo dentro mantendría la transacción abierta —y las filas bloqueadas— todo ese
rato, por nada.

## 6. Verificar el correo al restablecer

Si `email_verified_at` es `null`, el reset lo marca verificado
(`presentation/reset.service.ts:44` → `data/reset.repository.ts:40-42`). Recibir el enlace en esa
bandeja **es** la prueba que pide la verificación de correo, así que exigirla otra vez sería pedir
dos veces lo mismo. Lo manda el contrato §4.6.

Si ya estaba verificado, `mark_email_verified` va en `false` y la fecha original no se toca: es un
dato de auditoría («desde cuándo»), no un `updated_at`.

## 7. El correo de aviso no puede tumbar el reset

`notifyPasswordChanged` (`presentation/reset.service.ts:22-28`) es lo último y **traga el error**
del envío, dejándolo en el log. Es la única excepción a «los errores suben al manejador global»
en este slice, y tiene una razón concreta: cuando se llega a esa línea la contraseña ya cambió y
las sesiones ya se cerraron. Dejar subir un fallo de SMTP devolvería un `500` al usuario por una
operación que **sí** se completó, y lo más probable es que reintentara con un token que ya no
sirve. El aviso es una notificación, no parte de la operación.

El envío es dentro de la petición, sin cola, por la decisión D-002 (`02_reglas_backend.md` §2). El
mensaje del log es `SystemMessages.unhandled_error`: ver el apartado 9.

## 8. La respuesta

`200` con `description = AuthMessages.password_reset.success` y **sin `data`**: el contrato §4.6 no
promete cuerpo, y devolver una sesión nueva sería contradecir el propio endpoint, que acaba de
revocarlas todas. Tras esto el frontend manda a iniciar sesión.

El número de sesiones revocadas (`ConsumePasswordResetResult.revoked_sessions`) **no** sale en la
respuesta: le diría a quien tenga el token cuántos dispositivos tenía abiertos la víctima. Se
devuelve del repositorio porque es el dato natural de esa escritura y porque el día que se quiera
loguear está a mano.

## 9. Deudas conocidas

- **No hay mensaje propio para «falló el correo de aviso»**: `src/constants/messages/system.ts`
  no lo tiene, así que el `logger.warn` de `reset.service.ts:26` usa
  `SystemMessages.unhandled_error`, que es más genérico de lo que merece. Es un string en
  `src/constants` (archivo compartido, no editable desde este slice) y una línea aquí.
- **`AuthMessages.password_reset.same_password`** (`src/constants/messages/auth.ts:32`) existe y
  este slice no la usa: el contrato §4.6 no pide rechazar una contraseña igual a la anterior.
  Comprobarlo exigiría traer el `password_hash` viejo, que es justo lo que los `select` explícitos
  evitan. Si el producto lo quiere, es un cambio de contrato.
- **El rate limit es en memoria** (D-002): con varias instancias, los 20/hora se multiplican por
  el número de procesos.

## 10. Tests

`test/reset.service.test.ts` (9 casos) y `test/reset.controller.test.ts` (5 casos). Los mocks
apuntan al **path exacto** que importa la implementación (`02_reglas_backend.md` §10), lo que
además evita que el test arrastre Prisma: al mockear
`@/modules/auth/features/password_reset/reset/data/reset.repository` con factoría, el módulo real
—y con él `@/config/prisma_client`— no llega a cargarse.

`isTokenUsable` y `hashOneTimeToken` **no se mockean**: son puras y sin I/O, y mockearlas
convertiría «el token caducado se rechaza» en una tautología sobre el mock.

El test de controller monta un Express de verdad con `registerErrorHandler`
(`src/middlewares/error_handler.ts:159-162`) y llama por HTTP con Supertest. Es la forma de
comprobar el sobre, el `422` con `meta.fields` y el `400 TOKEN_INVALID` **sin un solo cast** para
fabricar un `Request` falso.
