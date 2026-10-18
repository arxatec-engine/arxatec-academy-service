# `src/config` — el porqué

Aquí vive lo que se configura una vez y se usa en todas partes: entorno, log y cliente de
Prisma. Todo lo demás (correo, Passport) aterriza aquí en la Fase 3 con la misma regla: **una
constante importada no puede arrancar Prisma ni nodemailer**.

## 1. El barril es flaco a propósito

`src/config/index.ts:1-2` reexporta **solo** `env` y `logger`. `prisma_client` se importa por su
ruta directa (`@/config/prisma_client`). Motivo, heredado del repo de referencia
(`02_reglas_backend.md` §8): un barril arrastra dependencias que el test no pidió y revienta
Jest con `SyntaxError: Unexpected token 'export'`. Aquí además tiene un coste concreto:
`src/config/prisma_client.ts:6-8` **instancia el adaptador y el cliente en tiempo de import**, así
que meterlo en el barril haría que `import { logger } from '@/config'` abriera un pool de
PostgreSQL en cada test unitario.

La regla la vigila `dependency-cruiser`: `no-config-barrel` en `.dependency-cruiser.cjs` prohíbe
que `src/config/index.ts` dependa de `prisma_client`, `email` o `passport`. El barril sigue
siendo importable para `env` y `logger` —es todo lo que reexporta—, pero **lo idiomático es el
submódulo**: `@/config/env`, `@/config/logger`. Los barriles que sí están prohibidos de raíz por
`no-restricted-imports` (`eslint.config.mjs`) son `@/utils`, `@/constants`, `@/infrastructure` y
`@/types`, que no deben existir nunca.

## 2. `dotenv` sin `override` — decisión tomada

`src/config/env.ts:6` carga el `.env` con `loadDotenv({ quiet: true })`, **sin `override: true`**.

El repo de referencia usa `config({ path: '.env', override: true })` y su propio `CLAUDE.md`
(§20) documenta la trampa que eso provoca: con `override`, el `.env` **gana sobre las variables
de entorno reales**, de modo que `DATABASE_URL=... pnpm dev` como prefijo *no* cambia de base de
datos y te cuesta una hora entender por qué.

Aquí se elige lo contrario: **la variable de entorno real manda y el `.env` solo rellena huecos**.
Es lo que esperan Docker, CI y cualquier `VAR=x pnpm ...` de un solo uso, y es la única forma de
que `pnpm test:integration:postgres` pueda apuntar a otra base sin editar ficheros. La
comprobación es directa:

```bash
JWT_SECRET=corto pnpm exec tsx -e "import('src/config/env.ts')"
# Error: La configuración del entorno no es válida: JWT_SECRET (Too small: ...)
```

Con `override: true` ese comando pasaría en verde, porque el `.env` habría pisado el valor.

El `quiet: true` no es cosmético: `dotenv@17` imprime por stdout un aviso promocional en cada
arranque, y **`console.log` está prohibido incluso en scripts** (`01_reglas_globales.md` §9).

## 3. Vacío ≠ ausente

`src/config/env.ts:51-61` filtra de `process.env` toda clave con valor `''` antes de validar.
Sin ese filtro, un `PORT=` vacío en el `.env` llega a `z.coerce.number()` como `0` y revienta el
arranque en vez de caer al default. Es la misma lección que el `||` (no `??`) del repo de
referencia, resuelta una sola vez y en un sitio.

## 4. Fallar al arrancar, no al usar

`src/config/env.ts:63-71` valida con Zod y **lanza** si algo falta. No hay valor por defecto para
`DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `GOOGLE_CALLBACK_URL` ni `EMAIL_FROM`: un
despliegue mal configurado tiene que morir en el primer segundo, no cuando el primer usuario
pida un correo de recuperación.

`JWT_SECRET` exige **32 caracteres o más** (`src/config/env.ts:20`). Un secreto HS256 más corto
que su propio hash es fuerza bruta gratis.

La regla condicional de `src/config/env.ts` exige `SMTP_HOST`, `SMTP_USER` y `SMTP_PASSWORD`
cuando `EMAIL_TRANSPORT=smtp`. En desarrollo y producción solo se admite SMTP; `log` queda
reservado para pruebas con `NODE_ENV=test`.

`env.ts` **no importa el logger**: el logger necesita `env.LOG_LEVEL`
(`src/config/logger.ts:24`), así que importarlo aquí sería un ciclo. Por eso el fallo se
comunica con un `Error`, no con un `logger.fatal`.

## 5. El log no puede filtrar secretos

`src/config/logger.ts:6-21` lista las rutas redactadas y `src/config/logger.ts:25` las borra
(`remove: true`, no las sustituye por `[Redacted]`): `authorization`, `cookie`, `set-cookie`,
`password`, `password_hash`, `token`, `token_hash` y los tokens de OAuth. Es la traducción
literal de `01_reglas_globales.md` §8.6 — *nunca se loguea una contraseña, un token ni una
cookie*.

`pino-pretty` se monta **solo en desarrollo** (`src/config/logger.ts:28-36`). En producción el
log es JSON de una línea: es lo que sabe leer el agregador, y el transporte de pretty cuesta un
worker thread por proceso.

## 6. Prisma va por adaptador

`src/config/prisma_client.ts:6` construye `PrismaPg` con `env.DATABASE_URL` y
`src/config/prisma_client.ts:8` se lo pasa al cliente. En Prisma 7 la URL **ya no puede vivir en
el `datasource` del esquema** (el propio CLI lo rechaza con `P1012`), así que el esquema declara
solo el `provider` (`prisma/schema/_base.prisma:7-9`), la URL de las migraciones vive en
`prisma.config.ts` y la del runtime en el adaptador. Un solo origen (`DATABASE_URL`), tres
consumidores.

`disconnectPrisma` (`src/config/prisma_client.ts:10`) existe para que `server.ts` la registre
como *closeable* y el apagado ordenado cierre el pool (`02_reglas_backend.md` §6).
