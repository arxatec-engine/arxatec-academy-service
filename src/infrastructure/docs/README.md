# `src/infrastructure` — el porqué

Cinco carpetas: `password/`, `jwt/`, `tokens/`, `email/` y `storage/`. Aquí vive lo que **habla con el
mundo o con la criptografía**, y por eso no está en `utils/`: la regla de `02_reglas_backend.md`
§9.7 es explícita —"la infraestructura no finge ser un util"—. Un util es puro y no tiene
configuración; estas cuatro leen `env`, tocan libretas nativas o abren conexiones SMTP.

Nadie importa un barril: `import { signSessionToken } from '@/infrastructure/jwt/sign_session_token'`.
`@/infrastructure` está en la lista de `no-restricted-imports` (`eslint.config.mjs:49-53`).

## 1. `password/` — argon2id y nada más

`hashPassword` y `verifyPassword` (`src/infrastructure/password/hash_password.ts:5,8`) usan
`argon2id` con **los parámetros por defecto de la librería** (D-003 y `01_reglas_globales.md` §8.1).
No se tocan: los defaults de `argon2` siguen la recomendación de OWASP y ajustarlos a ojo es la
forma más habitual de debilitarlos sin enterarse.

`verifyPassword` acepta `string | null` y devuelve `false` en dos casos que **no son un error**
(`src/infrastructure/password/hash_password.ts:12-20`):

1. **`password_hash` es `null`** → la cuenta se creó con Google y no tiene contraseña. Lanzar aquí
   obligaría al slice de login a envolver la llamada en un `try/catch` para poder responder el
   `409 ACCOUNT_USES_GOOGLE` del contrato §4.2.
2. **el hash guardado no es un hash de argon2** → dato corrupto en base de datos. `argon2.verify`
   lanza; convertirlo en `false` mantiene la respuesta indistinguible del "contraseña incorrecta"
   que exige `01_reglas_globales.md` §8.2, en vez de devolver un `500` que le diría al atacante
   que ese correo existe y tiene la fila rota.

**Módulo nativo.** `argon2` compila al instalar. Comprobado en este equipo (macOS arm64, Node
24.18.0): hash y verificación reales, cubierto por
`src/infrastructure/password/test/hash_password.test.ts`. En el Docker de despliegue hay que
verificarlo otra vez: es la consecuencia anotada en D-003.

## 2. `jwt/` — firma, verificación y el reparto de códigos de error

`signSessionToken` (`src/infrastructure/jwt/sign_session_token.ts:17`) emite exactamente los
claims del contrato §3: `sub` (id de usuario), `jti` (**id de la fila de `auth_sessions`**), `role`,
`iat`, `exp` e `iss`.

**`exp` es el tope absoluto de la sesión, no su caducidad deslizante** (`:24-34`). El llamador pasa
`absolute_expires_at`, que sale de `computeSessionAbsoluteExpiresAt`
(`src/modules/auth/shared/policy/session_policy.ts:36-37`): `auth_sessions.created_at` + 180 días
(`AuthTokenTtlSeconds.session_absolute_max`).

**Por qué no se firma con el `expires_at` de la fila, que es lo que hacía antes.** Porque el
`expires_at` de la fila **se mueve** (caducidad deslizante, contrato §3) y el `exp` de un JWT
firmado **no**. Firmar el uno con el otro producía este fallo, que ningún test cubría: un usuario
con `remember_me` que entraba todos los días era expulsado con `SESSION_EXPIRED` y la pantalla E7
**el día 31**, con su fila viva y sin revocar en la base, mientras el producto le promete "cerramos
la sesión tras 30 días **sin uso**". Afectaba a los cuatro caminos que abren sesión (registro,
login y canje de Google) y no hay endpoint de refresco donde recuperarse.

De las dos salidas posibles se tomó la segunda, y está escrita en el contrato §3:

| Salida | Por qué no / por qué sí |
| --- | --- |
| Reemitir el token cada vez que la renovación deslizante escribe | **No.** Cambia el contrato de las respuestas (habría que devolver un `token` nuevo en cualquier endpoint autenticado) y obliga al adaptador del frontend a guardarlo; es un cambio de los dos lados para un problema que no lo necesita |
| Firmar el `exp` con un **techo mayor que la ventana de inactividad** y dejar que la fila sea la única autoridad | **Sí.** Es lo que el contrato §3 ya decía en palabras ("la base de datos es la autoridad, no el JWT"): el token sin fila viva no abre nada, porque cada petición autenticada consulta `auth_sessions` |

Para que la fila no prometa nunca más vida que el token, la renovación deslizante corta en ese
mismo tope (`session_policy.ts:48-66`). Los 180 días son además una **caducidad absoluta real**:
por muy activa que esté, una sesión no vive más que eso sin volver a iniciarla.

`data.expires_at` de la respuesta sigue siendo el `expires_at` **de la fila** (la caducidad por
inactividad), que es lo que el frontend pinta y lo que el contrato §3 describe; el `exp` del token
no aparece en ninguna respuesta.

El archivo exporta **dos funciones sobre la misma verificación**, y la fase 09 las separó a
propósito:

| Export | Devuelve | Quién la usa |
| --- | --- | --- |
| `readSessionToken` (`src/infrastructure/jwt/verify_session_token.ts:27`) | `{ valid, payload }` o `{ valid: false, expired }` | `resolve_request_session.ts`, que necesita **decidir** qué hacer con un token roto |
| `verifySessionToken` (`:44`) | el payload, o **lanza** | lo que quede que prefiera la excepción |

`verifySessionToken` es **quien reparte los dos códigos que el frontend necesita distinguir**
(`:51`):

| Causa | `meta.code` | Por qué |
| --- | --- | --- |
| `TokenExpiredError` (`:36`) | `SESSION_EXPIRED` | pantalla E7, conservando el destino de retorno |
| firma inválida, otro emisor, otro algoritmo, forma inesperada | `UNAUTHENTICATED` | a login, sin ceremonia |

**Por qué la variante que no lanza.** `GET /courses/:slug` es público con Bearer opcional: un token
caducado tiene que dejar pasar al visitante como anónimo, no devolver `401`. Un `try/catch`
alrededor de `verifySessionToken` haría eso mismo, pero se tragaría también lo que no debe; el
porqué largo está en `src/middlewares/docs/README.md` §10. Con `readSessionToken`, el `throw` deja
de ser la única forma de contar que un token no sirve, y el `try/catch` que queda
(`:30-37`) rodea **solo** la llamada a `jsonwebtoken`, que es una librería que señala fallando.

La forma del payload **se valida con Zod** (`src/infrastructure/jwt/session_token.schema.ts:5-12`),
no con un cast. `jwt.verify` devuelve `string | JwtPayload`, y `JwtPayload` tiene índice `any`:
confiar en él sería meter un `any` por la puerta de atrás justo en la frontera menos fiable del
sistema —un token que escribe el cliente—. `role` se valida contra el enum real de Prisma
(`src/generated/enums.ts:11-16`), así que un `role: "SUPERADMIN"` firmado con el secreto correcto
se rechaza igual. Está cubierto en `src/infrastructure/jwt/test/session_token.test.ts`.

`algorithms: [JwtAlgorithm]` (`src/infrastructure/jwt/verify_session_token.ts:32`) fija HS256 en
la verificación. Sin la lista, `jsonwebtoken` aceptaría el algoritmo que declare el propio token,
que es el ataque `alg` clásico.

## 3. `tokens/` — un solo uso, guardado hasheado

`createOneTimeToken` (`src/infrastructure/tokens/one_time_token.ts:14`) devuelve tres cosas:
el `token` que va **al correo**, el `token_hash` que va **a la base de datos** y el `expires_at`.

**En `auth_tokens` solo se guarda el hash** (`01_reglas_globales.md` §8.3). SHA-256 en hexadecimal
son 64 caracteres, que es exactamente el ancho de `auth_tokens.token_hash`
(`prisma/schema/auth.prisma:22`). Si se filtra la base de datos, ninguna de esas filas sirve para
verificar un correo ni para restablecer una contraseña.

**SHA-256 sin sal está bien aquí y no lo estaría para una contraseña.** La diferencia es la
entropía de la entrada: 32 bytes de `randomBytes` (`AuthPolicy.one_time_token_bytes`,
`src/constants/auth.ts:22`) no son adivinables por fuerza bruta ni por diccionario, así que el
coste de argon2 no compraría nada y sí encarecería cada verificación de enlace.

`base64url` (`:15`) evita `+`, `/` y `=`, que necesitarían escaparse dentro del query param del
enlace y que los clientes de correo rompen al autoenlazar.

`isTokenUsable` (`:24`) concentra la doble condición "sin consumir **y** no vencido". Vence en el
instante exacto de `expires_at`, no un milisegundo después.

## 4. `email/` — transporte conmutable y tres plantillas

```text
config/email.ts                     -> el transporte SMTP (perezoso, se cierra en el apagado)
infrastructure/email/send_email.ts  -> decide log | smtp
infrastructure/email/frontend_link.ts
infrastructure/email/templates/     -> email_layout + las tres del contrato §8
```

**Por qué el transporte vive en `config/` y el envío en `infrastructure/`.** `02_reglas_backend.md`
§4 lista `email` entre los archivos de `config/`, y §8 exige que importar una constante no arranque
nodemailer. `config/email.ts` es el único que construye el `Transporter`, y lo hace **perezosamente**
(`src/config/email.ts:18-22`): con `EMAIL_TRANSPORT=log` no se crea nunca. `config/index.ts` no lo
reexporta, y `no-config-barrel` (`.dependency-cruiser.cjs:31-37`) impide que alguien lo añada.

`sendEmail` (`src/infrastructure/email/send_email.ts:30`) elige transporte por `EMAIL_TRANSPORT`:

- **`log`** → el correo se escribe con Pino solo en pruebas (`NODE_ENV=test`), sin entrega real.
- **`smtp`** → nodemailer, y el `env` ya obligó a que `SMTP_HOST`, `SMTP_USER` y `SMTP_PASSWORD`
  existan al arrancar (`src/config/env.ts:37-47`).

**El único sitio donde un token toca el log, y su freno.** El cuerpo del correo lleva el enlace, y
el enlace lleva el token. Registrarlo contradice literalmente `01_reglas_globales.md` §8.6, así que
el cuerpo se omite cuando `isProduction` (`src/infrastructure/email/send_email.ts:7-16`): en
pruebas el enlace se puede leer del log; en producción el transporte es SMTP y el logger solo
registra destinatario y asunto.

**Ninguna plantilla loguea nada.** Las tres son funciones puras que devuelven `{ subject, html, text }`
(`src/infrastructure/email/email.types.ts:1-5`); la única que escribe es `sendEmail`.

| Plantilla | Disparador | Enlace |
| --- | --- | --- |
| `buildVerificationEmail` (`email/templates/verification_email.ts:12`) | registro y reenvío | `${FRONTEND_URL}/verificar-correo?token=…` (24 h) |
| `buildPasswordResetEmail` (`email/templates/password_reset_email.ts:12`) | `/auth/password/forgot` | `${FRONTEND_URL}/restablecer-contrasena?token=…` (1 h) |
| `buildPasswordChangedEmail` (`email/templates/password_changed_email.ts:5`) | reset consumido | **ninguno**, es un aviso |

Las rutas salen de `FrontendRoutes` (`src/constants/endpoints.ts:78-88`) y están en español porque
son producto (`01_reglas_globales.md` §1); los textos, de `AuthMessages.email`
(`src/constants/messages/auth.ts:67-82`).

`buildFrontendLink` (`src/infrastructure/email/frontend_link.ts:11`) construye el enlace con `URL`
para que el token quede codificado bien, y **pasa el `redirect_to` por `isSafeRedirect`**
(`:18-20`). Es el mismo filtro del contrato §7 y la misma función testeada: un
`redirect_to=https://malo.pe` no llega al correo, y sin eso el enlace de recuperación —que el
usuario abre confiando en nosotros— sería un redirector abierto firmado por la marca. Comprobado:
el enlace generado con ese valor no contiene el host externo.

`escapeHtml` (`src/infrastructure/email/templates/email_layout.ts:24`) escapa **todo** lo que entra
en el HTML, incluida la URL del botón. Hoy los textos son constantes, pero el día que una plantilla
salude por el nombre del usuario, el escape ya está puesto: el nombre lo escribe el usuario en el
registro.

Cada correo se manda **dentro de la petición**, sin cola (D-002). Consecuencia: un SMTP caído hace
fallar el envío, y por eso el registro tiene que crear la cuenta y devolver sesión aunque el correo
falle. El punto de corte para meter una cola es este archivo.

## 5. `storage/` — el puerto de archivos

Tiene **su propio README** (`src/infrastructure/storage/docs/README.md`) porque es la única
carpeta de `infrastructure/` con dos implementaciones intercambiables y con una decisión de
producto detrás (qué formato y qué tamaño se acepta en cada uno de los tres usos).

Lo mínimo que hay que saber desde fuera: se importa `storage`
(`src/infrastructure/storage/storage.ts:7`), que es un `StoragePort` ya elegido por
`env.STORAGE_DRIVER`, y **antes de guardar nada se llama a `validateUpload`**
(`src/infrastructure/storage/validate_upload.ts:35`). El adaptador de S3 está declarado y **lanza**;
el de desarrollo escribe bajo `STORAGE_LOCAL_PATH` y se sirve por `/files`.
