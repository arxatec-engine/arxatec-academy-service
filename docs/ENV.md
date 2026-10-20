# Variables de entorno

La fuente ejecutable es [src/config/env.ts](../src/config/env.ts). Dotenv lee `.env` sin
reemplazar variables ya inyectadas; los valores vacíos se descartan antes de validar. El esquema
Zod falla al importar configuración si faltan valores obligatorios.

## Infisical

Los scripts leen el `workspaceId` de `.infisical.json` y lo pasan como `--projectId`, siguiendo
el patrón de Admin con pnpm. Instala Infisical CLI y ejecuta `infisical login` en el equipo
local con acceso al proyecto del servicio. El proyecto del frontend se configura por separado.
Agrega las variables de esta guía en la raíz `/` de los entornos `dev` y `prod`.

| Comando                                                            | Entorno de Infisical                    |
| ------------------------------------------------------------------ | --------------------------------------- |
| `pnpm dev` / `pnpm build:dev`                                      | `dev`                                   |
| `pnpm build:prod` / `pnpm build` / `pnpm start`                    | `prod`                                  |
| `pnpm prisma:migrate`                                              | `dev`; ejecuta `prisma migrate dev`     |
| `pnpm prisma:deploy`                                               | `prod`; ejecuta `prisma migrate deploy` |
| `pnpm seed` / `pnpm seed:exams` / `pnpm storage:check:development` | `dev`                                   |

Las tareas tienen variantes `:local` que usan el entorno existente y el `.env` de la raíz,
sin consultar Infisical. `build:local` y `dev:local` generan el cliente Prisma antes de ejecutar
su tarea. `prisma:generate`, lint, tipos y tests siguen usando el entorno existente.
Para archivos locales, copia [.env.example](../.env.example) a `.env`. No hay carga especial de
`.env.local`. Las variables inyectadas tienen prioridad y Dotenv solo completa las ausentes.

Configura `NODE_ENV=development` en `dev` y `NODE_ENV=production` en `prod`: el nombre del entorno
Infisical no sustituye esa variable de Node. Las variables `SEED_*` se validan aparte al ejecutar
la semilla y corresponden al entorno de desarrollo.

Se mantiene `CLOUDFRONT_ACADEMY_PRODUCT_PRIVATE_KEY_PATH=./.cloudfront.private.pem` para la firma
desde archivo. El PEM debe existir en la raíz del servicio al ejecutar; guardar la ruta en
Infisical no crea el archivo. Con esta opción, deja sin definir la variable de clave inline.

## Servidor y base de datos

| Variable       | Obligatoria | Default       | Regla y uso                                                                       |
| -------------- | ----------- | ------------- | --------------------------------------------------------------------------------- |
| `NODE_ENV`     | No          | `development` | `development`, `test` o `production`; controla formato de logs y algunos defaults |
| `PORT`         | No          | `3001`        | Entero 1–65535, puerto HTTP                                                       |
| `LOG_LEVEL`    | No          | `info`        | `fatal`, `error`, `warn`, `info`, `debug`, `trace` o `silent`                     |
| `DATABASE_URL` | Sí          | —             | Cadena no vacía de PostgreSQL para aplicación, migraciones y tests de integración |

El [Compose local](../docker-compose.yml) fija usuario/base/contraseña de desarrollo y publica
PostgreSQL 16 en `5444`. No toma esos valores de `DATABASE_URL`: la URL del cliente debe apuntar
al contenedor que Compose configura. El volumen conserva datos entre reinicios.

```dotenv
DATABASE_URL=postgresql://arxatec:arxatec@localhost:5444/arxatec_academy?schema=public
```

Es una configuración pública de desarrollo, no una credencial de producción. Para integración,
exportar una `DATABASE_URL` de base desechable: `TEST_DATABASE_URL` no es consumida por la suite
actual. [TESTING](TESTING.md) explica preparación y limpieza.

`trust proxy` está fijado a un salto en `ServerPolicy`; no existe una variable `TRUST_PROXY`.
Tampoco existen variables de presupuesto del pool o de la cola Argon2 en el esquema actual.

## Identidad JWT y frontend

| Variable               | Obligatoria          | Default           | Regla y uso                                                                     |
| ---------------------- | -------------------- | ----------------- | ------------------------------------------------------------------------------- |
| `JWT_SECRET`           | Sí                   | —                 | Mínimo 32 caracteres; firma HS256 de sesiones y state OAuth                     |
| `JWT_ISSUER`           | No                   | `arxatec-academy` | Identificador `iss`, no vacío                                                   |
| `FRONTEND_URL`         | Sí                   | —                 | URL absoluta; origen CORS, enlaces de correo, certificados y redirección Google |
| `GOOGLE_CALLBACK_URL`  | Sí                   | —                 | URL absoluta del callback backend, incluso si no se usa Google                  |
| `GOOGLE_CLIENT_ID`     | Para utilizar Google | —                 | Identificador de la aplicación OAuth                                            |
| `GOOGLE_CLIENT_SECRET` | Para utilizar Google | —                 | Secreto OAuth del backend                                                       |

El callback local de ejemplo es `http://localhost:3001/api/v1/auth/google/callback`. Debe
coincidir con el registrado en Google. Las credenciales de Google son opcionales al arrancar;
la estrategia se registra al utilizarla y falla explícitamente si no están configuradas.

CORS deriva un único origen con `new URL(FRONTEND_URL).origin`; no lee una lista
`ADMIN_ALLOWED_ORIGINS`. El nonce OAuth se guarda en cookie HttpOnly, SameSite Lax, con Secure
en producción. Las sesiones de Academy se entregan como JWT Bearer en JSON, no como cookie de
sesión de Admin.

Cambiar `JWT_SECRET` invalida tokens ya firmados. No colocar ese secreto ni credenciales de
base/SMTP/AWS en `VITE_*`. Las rutas de frontend usadas por correo están en
[endpoints](../src/constants/endpoints.ts): `/verificar-correo`, `/restablecer-contrasena` y
`/oauth/callback` para los flujos correspondientes.

## Correo

| Variable          | Obligatoria | Default | Regla y uso                                              |
| ----------------- | ----------- | ------- | -------------------------------------------------------- |
| `EMAIL_TRANSPORT` | No          | `smtp`  | `smtp` en local y producción; `log` solo en tests        |
| `EMAIL_FROM`      | Sí          | —       | Remitente, cadena no vacía                               |
| `SMTP_HOST`       | Si `smtp`   | —       | Host SMTP, no vacío                                      |
| `SMTP_PORT`       | No          | `587`   | Entero 1–65535                                           |
| `SMTP_SECURE`     | No          | `false` | Texto literal `true`/`false`; TLS directo cuando es true |
| `SMTP_USER`       | Si `smtp`   | —       | Usuario no vacío                                         |
| `SMTP_PASSWORD`   | Si `smtp`   | —       | Contraseña no vacía                                      |

El esquema exige host/usuario/contraseña para SMTP y rechaza `log` fuera de `NODE_ENV=test`.
El remitente debe coincidir con `SMTP_USER` o ser un alias que autorice el proveedor. En Academy
se puede reutilizar el servidor SMTP de Lawyer, configurando sus credenciales como `SMTP_USER` y
`SMTP_PASSWORD` en cada entorno, sin exponerlas en el frontend. `verify()` de Nodemailer confirma
la conexión y autenticación, pero la entrega final depende del servidor y del buzón de destino.

Registro tolera errores de entrega, conserva cuenta/sesión y devuelve
`verification_email_sent: false` para mostrar reenvío inmediato. Recuperación inicia el envío sin
esperarlo, con la respuesta protegida por un suelo de tiempo. El aviso de cambio de contraseña
también registra el fallo sin deshacer el cambio. No hay cola ni worker de correo.

## Almacenamiento

La validación de estas variables está en [storage_env](../src/config/storage_env.ts).

Con `STORAGE_DRIVER=s3`, los nombres de producto tienen prioridad sobre los genéricos:

| Nombre de producto                            | Alias genérico interno        |
| --------------------------------------------- | ----------------------------- |
| `S3_ACADEMY_PRODUCT_BUCKET`                   | `AWS_S3_BUCKET`               |
| `CDN_ACADEMY_PRODUCT_BASE_URL`                | `STORAGE_PUBLIC_URL`          |
| `CLOUDFRONT_ACADEMY_PRODUCT_KEY_PAIR_ID`      | `CLOUDFRONT_KEY_PAIR_ID`      |
| `CLOUDFRONT_ACADEMY_PRODUCT_PRIVATE_KEY`      | `CLOUDFRONT_PRIVATE_KEY`      |
| `CLOUDFRONT_ACADEMY_PRODUCT_PRIVATE_KEY_PATH` | `CLOUDFRONT_PRIVATE_KEY_PATH` |
| `CLOUDFRONT_SIGNED_URL_TTL_SECONDS`           | `CLOUDFRONT_URL_TTL_SECONDS`  |

Con local, esas variables no sustituyen la URL de `/files`. Las subidas nuevas de portadas y
avatares usan `/public/` sin firma; los recursos usan `/private/` y URLs firmadas.

| Variable                      | Obligatoria             | Default                       | Regla y uso                                                          |
| ----------------------------- | ----------------------- | ----------------------------- | -------------------------------------------------------------------- |
| `STORAGE_DRIVER`              | No                      | `local`                       | `local` o `s3`, ambos implementados                                  |
| `STORAGE_LOCAL_PATH`          | No                      | `storage`                     | Carpeta local persistente                                            |
| `STORAGE_PUBLIC_URL`          | Si `s3`                 | `http://localhost:3001/files` | En S3, base CDN HTTPS sin credenciales, query ni fragmento           |
| `AWS_REGION`                  | Si `s3`                 | —                             | Región del bucket                                                    |
| `AWS_S3_BUCKET`               | Si `s3`                 | —                             | Nombre del bucket, no dominio                                        |
| `AWS_ACCESS_KEY_ID`           | No                      | —                             | Con secret, o ambas ausentes para IAM/default credential chain       |
| `AWS_SECRET_ACCESS_KEY`       | Si se define access key | —                             | Siempre el par completo                                              |
| `AWS_SESSION_TOKEN`           | No                      | —                             | Token para credenciales temporales                                   |
| `CLOUDFRONT_KEY_PAIR_ID`      | Si `s3`                 | —                             | ID de clave pública del grupo confiable, no ID de grupo/distribución |
| `CLOUDFRONT_PRIVATE_KEY`      | Una fuente si `s3`      | —                             | PEM RSA 2048 inline, admite saltos escapados                         |
| `CLOUDFRONT_PRIVATE_KEY_PATH` | Alternativa al inline   | —                             | Archivo PEM privado legible por el proceso                           |
| `CLOUDFRONT_URL_TTL_SECONDS`  | No                      | `300`                         | Entero entre 1 y 86400                                               |

Con S3, configurar exactamente una fuente de PEM. El arranque rechaza una configuración
incompleta, un PEM ilegible/inválido o una clave que no sea RSA 2048. No hay fallback público.
El comportamiento `/private/*` debe exigir URLs firmadas y usar el grupo confiable;
`/public/*` permite lectura sin firma; el origen S3 permanece
privado con OAC. Los fallos de operación producen `503 STORAGE_UNAVAILABLE`.

La DB conserva URL canónica y clave. Las respuestas renuevan la firma desde la clave usando
el dominio vigente, sin persistir enlaces temporales. Filas sin clave conservan su URL original.
Antes de cambiar de driver, migrar bytes manteniendo claves y revisar filas legacy. Ver
[STORAGE](STORAGE.md) para permisos, caducidad, caché y comprobaciones reales.

## Video y reportes administrativos

| Variable                       | Obligatoria      | Default                                                  | Regla y uso                                                                              |
| ------------------------------ | ---------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `VIDEO_PROVIDER_DRIVER`        | No               | `fake` fuera de producción; `live` en producción         | `live`, `fake` o `vimeo`; `vimeo` es alias heredado del modo live para ambos proveedores |
| `VIDEO_PROBE_TIMEOUT_MS`       | No               | `3000`                                                   | Entero positivo para timeout de oEmbed                                                   |
| `REPORTING_UTC_OFFSET_MINUTES` | No               | `-300`                                                   | Entero; offset fijo para fechas de reportes, Lima por defecto                            |
| `ADMIN_EXPORT_MAX_ROWS`        | No               | `50000`                                                  | Entero positivo; tope del CSV de usuarios                                                |
| `NOTIFICATIONS_IP_HASH_SALT`   | Sí en producción | `local-notifications-salt-change-me` fuera de producción | Mínimo 16 caracteres; producción rechaza el default de desarrollo                        |

El default de video se determina al cargar el esquema usando `process.env.NODE_ENV`.
No hace falta una clave API YouTube: el adaptador usa oEmbed, que no devuelve duración; el editor
debe enviar segundos positivos. El modo fake puede seleccionarse explícitamente incluso en
producción y no prueba disponibilidad real.

El offset de reportes no es una zona IANA ni cambia automáticamente por horario de verano.
Con `-300`, el inicio de un día Lima es `05:00:00Z`. `ADMIN_EXPORT_MAX_ROWS` no limita el CSV
de avisos. La sal se usa para hashear IP en avisos/temas; no cambia el almacenamiento de IP de
sesiones de autenticación. Evitar describir toda la aplicación como libre de IP en claro.

## Semilla de desarrollo

| Variable                | Obligatoria para `pnpm seed` | Regla                                       |
| ----------------------- | ---------------------------- | ------------------------------------------- |
| `SEED_ADMIN_EMAIL`      | Sí                           | Email válido de la cuenta ADMIN de prueba   |
| `SEED_ADMIN_PASSWORD`   | Sí                           | Mínimo 8 caracteres                         |
| `SEED_STUDENT_EMAIL`    | Sí                           | Email válido de la cuenta STUDENT de prueba |
| `SEED_STUDENT_PASSWORD` | Sí                           | Mínimo 8 caracteres                         |

La semilla valida estas cuatro variables en [seed_env](../src/seed/seed_env.ts) sin defaults de
credenciales, y aborta con `NODE_ENV=production`. Actualiza contraseñas/roles de las cuentas
sembradas y el contenido identificado por slugs; elimina lecciones ajenas al fixture en esos
cursos y reconstruye sus recursos. No es una herramienta de bootstrap productivo ni una carga
que preserve cualquier edición local. Usarla únicamente sobre datos de desarrollo controlados.
También añade los avisos y solicitudes de tema de ejemplo que falten, sin reiniciar los estados
de notificación ni incrementar de nuevo los contadores de solicitudes existentes.

## Constantes que no son variables

TTL de sesión/token, cooldowns, rate limits, límites de campos, tipos de archivo y códigos de
error viven en `src/constants`. La duración de sesión es 30 días o 12 horas por inactividad y
180 días absolutos; reenvío espera 45 segundos. Cambiarlos modifica contrato y pruebas.

El límite de JSON, proxy y watchdog viven en `ServerPolicy`. No documentar como configurables
opciones ausentes del schema. Si se añade una variable, actualizar esta guía, `.env.example`,
la validación y el procedimiento de despliegue en la misma entrega.
