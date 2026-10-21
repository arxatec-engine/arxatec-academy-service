# Deployment

Academy's artifact is `dist/server.js` with compiled modules and runtime dependencies. It requires Node.js >=22.12, the pnpm version in `packageManager`, and PostgreSQL with this service's migrations. Operational commands load configuration through Infisical CLI >=0.43.145 and the project in `.infisical.yaml`.

## Environment configuration

Install Infisical CLI >=0.43.145 and configure authentication authorized for the service project. Locally use `infisical login`; deployment must provide noninteractive authentication. Configure backend variables at `/` in `prod` as documented in [ENV](ENV.md). Development commands use `dev`.

Include `.infisical.yaml` in the release directory/container image. The script explicitly passes `project-id`, including with machine identities. `yaml` is a runtime dependency because `pnpm start` also reads it.

Local `.env`, `.env.example`, and repository-local CloudFront PEM files are not distributed. Keep server configuration, process supervision, certificates, and secrets in the appropriate environment/secret manager. Never deploy seed credentials or copy another application's local configuration.

At minimum provide `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `GOOGLE_CALLBACK_URL`, and `EMAIL_FROM`. Production requires `NODE_ENV=production`, a dedicated `NOTIFICATIONS_IP_HASH_SALT`, `EMAIL_TRANSPORT=smtp`, and the authorized server's `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASSWORD`. Use `VIDEO_PROVIDER_DRIVER=live` for real video metadata. Startup rejects log email outside tests. `EMAIL_FROM` must be the authenticated mailbox or an authorized alias.

With `STORAGE_DRIVER=local`, provide a writable persistent volume and correct public URL. With S3, configure bucket/region, HTTPS CloudFront domain, and its signing key through Infisical or a mounted secret. Keep S3 private with OAC and require signed URLs on `/private/*`; `/public/*` permits unsigned reads. Migrate bytes under their existing keys before switching drivers and verify access as described in [STORAGE](STORAGE.md). Coordinate database/file backups; restoring only one can leave broken references.

## Build and migrations

From a clean release directory with CLI access to `prod`:

```sh
pnpm install --frozen-lockfile
pnpm build:prod
pnpm prisma:deploy
pnpm start
```

`build` aliases `build:prod`; `build:dev` loads `dev`. Both run `build:local`, which generates Prisma, compiles TypeScript, rewrites aliases through `tsc-alias`, and copies certificate fonts/assets to `dist/infrastructure/certificates/assets`. Builds do not clean `dist` or apply migrations. A clean directory prevents JavaScript from removed source files surviving. Retain the lockfile and development tools during compilation. `start` injects `prod` configuration into the compiled process.

`build:local`, `start:local`, `prisma:migrate:local`, and `prisma:deploy:local` support an environment already injected by infrastructure without querying Infisical.

The schema lives in `prisma/schema`, migrations in `prisma/migrations`. `pnpm prisma:migrate` loads `dev` and runs `migrate dev`; production `pnpm prisma:deploy` loads `prod` and applies versioned migrations through `migrate deploy` after review and backup. Apply `20261021030000_storage_deletions` before starting this backend: its table and triggers support durable cleanup, including cascades. `db push` does not install those triggers. Seeding is not a production step and aborts with `NODE_ENV=production`.

## Proxy, origin, and files

Express fixes `trust proxy` at one hop. Deployment topology must match and preserve client IP reliably; Academy has no `TRUST_PROXY` variable. IP rate limits depend on this setting.

CORS accepts the origin derived from `FRONTEND_URL` and requests without Origin, not a separate multi-domain list. The reverse proxy terminates HTTPS, forwards required headers, and allows resource multipart requests up to 20 MiB plus framing. JSON and urlencoded retain Express's 1 MiB limits.

With local storage, `/files` is public without Bearer. Ensure `STORAGE_PUBLIC_URL` is browser-reachable and the volume survives releases. Keyed rows resolve against the current base; keyless rows retain their URL. See [STORAGE](STORAGE.md).

## Post-start verification

```sh
curl --fail --silent --show-error http://127.0.0.1:3001/ping
```

`PORT` may override 3001. `/ping` returns text and checks HTTP only; it does not query PostgreSQL. There are no Admin-style `/health/live` or `/health/ready` routes and no database check before listening. Verify data availability separately through a harmless catalog read or an authorized review session. Do not create accounts or publish content solely to test a real deployment.

Review anonymous catalog access, denied administration without Bearer, final-origin CORS, file reads, and email delivery with controlled fixtures. Google requires callback/origin agreement with provider configuration. Test playback from the final domain: oEmbed does not certify every embed restriction. Confirm cleanup queue processing and S3 deletion using disposable owned fixtures.

## Shutdown, upgrades, and recovery

SIGTERM/SIGINT close resources in reverse registration order: HTTP, storage cleanup worker, Prisma, then email. The watchdog is ten seconds. Ensure process supervision allows orderly closure; interrupted cleanup jobs remain persisted and can be recovered after their lease expires.

Code rollback does not automatically reverse the schema. Review compatibility of the previous release with applied migrations; data changes need their own recovery procedure. Do not replace that procedure with `db push`, reset, or a production seed.

[Production readiness](PRODUCTION_READINESS.md) separates implementation from operational verification still required. This guide describes release preparation and does not claim that a deployment has occurred.
