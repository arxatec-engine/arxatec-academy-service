# Arxatec Academy Service

The REST API for Arxatec Academy. It provides student accounts, a public course catalog, lessons, progress, exams and certificates, comments, notifications, and editorial administration.

Built with Express 5, strict TypeScript, Zod, Prisma 7, and PostgreSQL. Files use local storage or private S3 with CloudFront delivery; email uses SMTP outside tests.

## Requirements

- Node.js >=22.12 and pnpm pinned by `packageManager`.
- PostgreSQL with this service's versioned migrations.
- Infisical CLI >=0.43.145, authenticated for the project in `.infisical.yaml`.
- SMTP for development/production; AWS and CloudFront configuration when `STORAGE_DRIVER=s3`.

## Development

```sh
pnpm install --frozen-lockfile
infisical login
pnpm prisma:migrate
pnpm dev
```

Configure backend variables at `/` in the Infisical `dev` environment first. See [Environment](docs/ENV.md) for every variable and validation rule. Configuration files containing local credentials and CloudFront PEM files are not included. Use Infisical or variables injected by your environment; mount signing keys through your secret manager if using the supported path option.

`pnpm seed` creates development fixtures and is blocked in production. It updates sample data and must not run against production or a database that must be preserved. `pnpm seed:exams` adds missing sample exams without replacing existing ones.

## Verification

```sh
pnpm prisma:generate
pnpm lint
pnpm typecheck
pnpm typecheck:tests
pnpm boundaries
pnpm docs:citations
pnpm test
pnpm build:local
```

Tests and Prisma generation need explicit environment variables when running without Infisical. Use the non-secret test values in [Testing](docs/TESTING.md). PostgreSQL integration tests require their own disposable database; they use `DATABASE_URL` and must never target production.

## Production release

With authenticated Infisical access and a reviewed `prod` configuration:

```sh
pnpm install --frozen-lockfile
pnpm build:prod
pnpm prisma:deploy
pnpm start
```

The artifact is `dist/server.js` with compiled modules, certificate assets, and runtime dependencies. Apply migrations before starting the new backend, including the persistent storage-cleanup queue and its triggers. Do not run `db push`, database reset, or the seed as a production deployment step.

`:local` scripts use an environment already injected by the deployment platform. `build:local` compiles without fetching secrets; this is not proof that production credentials, domains, SMTP, Google, or S3 are configured. See [Deployment](docs/DEPLOYMENT.md) and [Production readiness](docs/PRODUCTION_READINESS.md).

## Documentation

Start at [docs/README.md](docs/README.md). Key guides:

- [Architecture](docs/ARCHITECTURE.md) and [code style](docs/CODE_STYLING.md).
- [HTTP API](docs/API.md) and [environment](docs/ENV.md).
- [Storage and durable cleanup](docs/STORAGE.md).
- [Testing](docs/TESTING.md), [deployment](docs/DEPLOYMENT.md), and [release history](docs/shipped/README.md).

The sibling `arxatec-academy-platform` repository contains the frontend. API authorization, grading, certificate issuance, and persistence remain backend responsibilities.
