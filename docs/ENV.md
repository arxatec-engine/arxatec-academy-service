# Variables de entorno

Fuente de la verdad: `src/config/env.ts`. El esquema Zod está en `src/config/env.ts:10-47` y el
arranque **falla** si algo obligatorio falta (`src/config/env.ts:63-71`). `.env.example` es la
plantilla; cópiala a `.env` y rellena.

Dos comportamientos que conviene saber antes de depurar nada:

1. **La variable de entorno real gana sobre el `.env`.** El `dotenv` se carga sin `override`
   (`src/config/env.ts:6`), así que `DATABASE_URL=... pnpm seed` sí cambia de base de datos. El
   porqué está en `src/config/docs/README.md` §2. Justo por eso la semilla tiene sus propias
   defensas (ver **Semilla**): apuntar `pnpm seed` a otra base es un comando, no una ceremonia.
2. **Vacío cuenta como ausente.** Una clave con valor `''` se descarta antes de validar
   (`src/config/env.ts:51-61`), así que `PORT=` cae al default en vez de reventar.

## Servidor

| Variable | Obligatoria | Default | Valores | Para qué |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | no | `development` | `development` \| `test` \| `production` | decide `pino-pretty` y los defaults de arranque |
| `PORT` | no | `3001` | 1-65535 | puerto HTTP |
| `LOG_LEVEL` | no | `info` | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` \| `silent` | nivel de Pino (`src/config/logger.ts:24`) |

## Base de datos

| Variable | Obligatoria | Default | Para qué |
| --- | --- | --- | --- |
| `DATABASE_URL` | **sí** | — | cadena de conexión de PostgreSQL |

La usan tres consumidores desde un único origen: el adaptador del cliente
(`src/config/prisma_client.ts:6`), las migraciones (`prisma.config.ts`) y `docker-compose.yml`,
que publica el contenedor en **5444**: el 5432 lo puede tener un PostgreSQL local y el **5443 lo usa
`arxatec-lawyer-service`**, el producto hermano, que en muchos equipos corre a la vez que éste.

Valor de desarrollo con el `docker-compose.yml` de este repo:

```
DATABASE_URL=postgresql://arxatec:arxatec@localhost:5444/arxatec_academy?schema=public
```

## JWT

| Variable | Obligatoria | Default | Regla |
| --- | --- | --- | --- |
| `JWT_SECRET` | **sí** | — | mínimo **32 caracteres** (`src/config/env.ts:20`) |
| `JWT_ISSUER` | no | `arxatec-academy` | va en el `iss` del token |

El algoritmo es HS256 y es una constante del contrato, no del entorno
(`src/constants/auth.ts:44`). La caducidad tampoco se configura aquí: sale de
`AuthTokenTtlSeconds` (`src/constants/auth.ts:1-7`).

## Frontend

| Variable | Obligatoria | Default | Para qué |
| --- | --- | --- | --- |
| `FRONTEND_URL` | **sí** | — | base de los enlaces de correo y del `302` de Google |

Se concatena con `FrontendRoutes` (`src/constants/endpoints.ts:78-88`): `verificar-correo`,
`restablecer-contrasena`, `oauth/callback`. Ver `04_contrato_api_auth.md` §§8-11.

## Google OAuth 2.0

| Variable | Obligatoria | Default | Para qué |
| --- | --- | --- | --- |
| `GOOGLE_CLIENT_ID` | no | — | credencial de la app de Google |
| `GOOGLE_CLIENT_SECRET` | no | — | credencial de la app de Google |
| `GOOGLE_CALLBACK_URL` | **sí** | — | URL absoluta registrada en Google Cloud |

`GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` son opcionales en el esquema para que el módulo de
correo/contraseña se pueda desarrollar y testear sin una app de Google dada de alta. La
estrategia de Passport (Fase 3) debe fallar de forma explícita si faltan cuando alguien pega en
`/auth/google`; **no** se convierten en obligatorias globales porque eso bloquearía a quien solo
toca el login por contraseña.

`GOOGLE_CALLBACK_URL` sí es obligatoria y se valida como URL: apunta al propio backend
(`…/api/v1/auth/google/callback`) y tiene que coincidir carácter a carácter con la registrada en
Google, o el `redirect_uri_mismatch` aparece en producción y en ningún sitio más.

## Semilla

| Variable | Obligatoria | Default | Para qué |
| --- | --- | --- | --- |
| `SEED_ADMIN_EMAIL` | solo para `pnpm seed` | — | correo de la cuenta `ADMIN` de desarrollo |
| `SEED_ADMIN_PASSWORD` | solo para `pnpm seed` | — | su contraseña, mínimo 8 caracteres |
| `SEED_STUDENT_EMAIL` | solo para `pnpm seed` | — | correo de la cuenta `STUDENT` de ejemplo |
| `SEED_STUDENT_PASSWORD` | solo para `pnpm seed` | — | su contraseña, mínimo 8 caracteres |

**No tienen default y no pueden tenerlo.** Antes, las credenciales estaban escritas en
`src/seed/seed_data.ts`: un `ADMIN` con correo y contraseña **publicados en el historial de git**,
con `email_verified_at` ya puesto. Bastaba un `pnpm seed` lanzado con el `.env` de producción —o un
paso de despliegue que lo incluyera "para tener datos de ejemplo"— para dejar esa cuenta creada en
la base real, y borrar el archivo después no borra el historial. El rol `ADMIN` es del producto
entero (`02_reglas_backend.md` §2).

Ahora `src/seed/index.ts` **aborta con `logger.error` y `process.exitCode = 1`** en dos casos:
`NODE_ENV=production` (`SystemMessages.seed_forbidden_in_production`) y credenciales ausentes o
demasiado cortas (`SystemMessages.seed_credentials_missing`, validadas con Zod en
`src/seed/seed_env.ts`). El `upsert` además **sí** actualiza `password_hash`, para que cambiar la
variable y volver a sembrar rote de verdad la contraseña.

## Correo

| Variable | Obligatoria | Default | Para qué |
| --- | --- | --- | --- |
| `EMAIL_TRANSPORT` | no | `log` | `log` \| `smtp` |
| `EMAIL_FROM` | **sí** | — | remitente de los tres correos |
| `SMTP_HOST` | solo si `smtp` | — | servidor SMTP |
| `SMTP_PORT` | no | `587` | puerto SMTP |
| `SMTP_SECURE` | no | `false` | `true` \| `false` (TLS directo, típicamente en 465) |
| `SMTP_USER` | solo si `smtp` | — | usuario SMTP |
| `SMTP_PASSWORD` | solo si `smtp` | — | contraseña SMTP |

La condición está en `src/config/env.ts:37-47`: con `EMAIL_TRANSPORT=smtp`, faltar `SMTP_HOST`,
`SMTP_USER` o `SMTP_PASSWORD` impide arrancar. Con `log` (el default de desarrollo) el correo se
escribe en el log de Pino y el flujo entero —registro, verificación, recuperación— se puede
probar sin cuenta de correo (`04_contrato_api_auth.md` §8).

`SMTP_SECURE` se declara como `'true' | 'false'` y se transforma a booleano
(`src/config/env.ts:8`): en el entorno todo es texto, y `Boolean('false')` es `true`.

## Almacenamiento de archivos

| Variable | Obligatoria | Default | Para qué |
| --- | --- | --- | --- |
| `STORAGE_DRIVER` | no | `local` | `local` \| `s3` (`src/config/env.ts:38-40`) |
| `STORAGE_LOCAL_PATH` | no | `storage` | carpeta raíz del driver local, relativa al proceso |
| `STORAGE_PUBLIC_URL` | no | `http://localhost:3001/files` | base de la URL pública que devuelve `publicUrl` |
| `AWS_REGION` | solo si `s3` | — | región del bucket |
| `AWS_S3_BUCKET` | solo si `s3` | — | bucket de destino |
| `AWS_ACCESS_KEY_ID` | solo si `s3` | — | credencial |
| `AWS_SECRET_ACCESS_KEY` | solo si `s3` | — | credencial |

Las cuatro `AWS_*` son opcionales **mientras el driver sea `local`** y obligatorias en cuanto es
`s3` (`src/config/env.ts:58-71`), igual que las `SMTP_*` con `EMAIL_TRANSPORT=smtp`. El adaptador
de S3 **todavía no está implementado** y lanza al usarse
(`src/infrastructure/storage/s3_storage.adapter.ts:4-6`): el porqué está en
`src/infrastructure/storage/docs/README.md` §1.

`STORAGE_PUBLIC_URL` y el prefijo `/files` que monta `createApp()` (`src/app/create_app.ts:33`)
tienen que apuntar al mismo sitio: la URL se guarda **en la base de datos** (`lesson_resources.file_url`,
`courses.cover_image_url`), así que cambiarla no reescribe las filas ya escritas.

La carpeta local está ignorada por git como **`/storage`**, con barra inicial
(`.gitignore:18`). Sin ella el patrón habría ignorado también `src/infrastructure/storage/`, que
es código: un `.gitignore` sin anclar casa con cualquier carpeta de ese nombre a cualquier
profundidad, y el fallo no se ve —el código compila, los tests pasan— hasta que alguien clona el
repo y la carpeta no está.

## Lo que **no** es una variable de entorno

- **TTL, cooldowns y límites de peticiones** → `src/constants/auth.ts`. Son contrato, y cambiarlos
  es cambiar `04_contrato_api_auth.md` y los dos repos a la vez.
- **Códigos de error y textos** → `src/constants/error_codes.ts` y `src/constants/messages/`.
- **Ningún secreto viaja al frontend.** El bundle es público: solo `VITE_*` no sensibles
  (`01_reglas_globales.md` §8.7).
