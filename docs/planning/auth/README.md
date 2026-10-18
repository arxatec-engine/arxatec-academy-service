# Autenticación, sesiones y Google

**Estado:** implementado. [Contrato HTTP](../../API.md) ·
[Módulo](../../../src/modules/auth/docs/README.md) · [Índice](../README.md).
El actor pertenece a Academy y se autentica con correo/contraseña o Google.

## Fuentes y datos públicos

`users` conserva perfil, proveedor, rol y fecha de verificación; `auth_sessions` conserva estado
de sesión; `auth_tokens` los secretos hasheados; `oauth_accounts` la vinculación externa.
La API de usuario publica id, nombre, correo, rol, organización, independencia, ciudad,
avatar, verificación, proveedor y creación. Excluye hash, clave de avatar, tokens OAuth y
metadatos privados de sesión.

El registro solo exige `full_name`, `email` y `password`. Acepta perfil opcional; omitir ciudad
produce OTHER/null. Enviar OTHER explícito exige `city_other`. El rol no se elige desde el body:
se crea STUDENT. El correo se recorta y pasa a minúsculas; las contraseñas de 8–128 caracteres
se conservan exactamente. Login acepta contraseña no vacía, sin imponer de nuevo el mínimo.

## Acciones y resultados

| Acción bajo `/api/v1/auth` | Resultado                        | Regla                                              |
| -------------------------- | -------------------------------- | -------------------------------------------------- |
| `POST /register`           | 201 con token, expires_at y user | Crea cuenta y sesión; intenta verificar por correo |
| `POST /login`              | 200 con sesión                   | remember_me por defecto true                       |
| `GET /me`                  | 200 con user                     | Requiere JWT y sesión activa                       |
| `POST /logout`             | 200 sin data                     | Cierra la sesión identificada por jti; repetible   |
| `POST /password/forgot`    | 200 genérico                     | Correo existente/desconocido comparten respuesta   |
| `POST /password/reset`     | 200 sin data                     | Consume token y revoca todas las sesiones          |
| `POST /email/verify`       | 200 sin data                     | Segundo clic devuelve EMAIL_ALREADY_VERIFIED       |
| `POST /email/resend`       | 200 con espera                   | Sesión; cooldown de 45 segundos                    |
| `GET /google`              | 302 a Google                     | State firmado y nonce asociado al navegador        |
| `GET /google/callback`     | 302 al frontend                  | Código opaco de canje, no JWT                      |
| `POST /google/exchange`    | 200 con sesión                   | Código de 60 segundos y un uso                     |

## Sesión y autorización

El JWT tiene tope absoluto de 180 días. La fila aplica inactividad de 30 días con remember_me
o 12 horas sin él; autenticación obligatoria renueva cada cinco minutos como máximo. La
autenticación opcional no renueva ni responde 401 por un Bearer inválido: continúa como anónimo.
Una caída de base sigue siendo un error, no una sesión anónima inventada.

El rol y la verificación se leen del usuario relacionado, no del claim antiguo. Logout admite
una sesión revocada pero no un token falso ni una sesión caducada/inexistente. No existe refresh
token independiente. La cookie OAuth solo protege el handshake; no sustituye Bearer.

## Tokens, correo y concurrencia

El token de verificación dura 24 horas y el de recuperación una hora. Los repositorios
consumen por condición `consumed_at: null`. Reset agrupa consumo, hash, verificación y
revocación de sesiones en una transacción. Emitir un nuevo enlace invalida el anterior de ese
flujo. No devolver secretos ni el usuario a quien únicamente presenta el enlace de verificación.

Registro conserva la cuenta aunque falle SMTP. Forgot inicia el envío sin esperarlo y aplica
suelo de 400 ms. Login desconocido usa un hash Argon2 señuelo; Google sin contraseña conserva
el error explícito `409 ACCOUNT_USES_GOOGLE`. No se promete indistinguibilidad para todos los
tipos de cuenta.

`redirect_to` solo acepta un path relativo seguro; se rechazan esquemas, host, doble barra,
barra invertida y controles. El callback comprueba el state y su cookie antes del perfil;
un correo Google no verificado no vincula una cuenta existente.

## Pruebas, límites y pendientes

Los unitarios viven en cada acción; [auth_flow](../../../tests/integration/postgres/auth_flow.test.ts)
comprueba el flujo persistido y la revocación. Los tests Google usan colaboradores sustituidos
y no prueban un consentimiento real del proveedor. Límites detallados en [API](../../API.md).

Los repositorios de tokens siguen repartidos en varias acciones; consolidarlos en shared es
deuda técnica. Un fallo de proveedor en callback puede devolver JSON 500 al navegador; un
retorno de error por redirección necesita contrato compartido con el frontend. El alta inicial
de ADMIN productivo necesita procedimiento autorizado: el seed bloquea producción y el
registro público no eleva rol.
