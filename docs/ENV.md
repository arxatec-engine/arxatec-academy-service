# Environment variables

The executable source is [src/config/env.ts](../src/config/env.ts). Variables already injected into the process take priority. Empty values are discarded before validation, and Zod rejects missing required configuration when imported. Local `.env` and PEM files are not included; use Infisical or your deployment platform's injected environment and managed secrets.

## Infisical

The `infisical` script reads `secrets-management.project-id` from `.infisical.yaml` using `yaml` and passes it to the CLI as `--projectId`, including for machine identities. Infisical CLI >=0.43.145 is required in development, CI, and deployment. Run `infisical login` locally with access to the service project. The frontend project is configured separately. Add this guide's variables at `/` in `dev` and `prod`.

| Command                                                            | Infisical environment                 |
| ------------------------------------------------------------------ | ------------------------------------- |
| `pnpm dev` / `pnpm build:dev`                                      | `dev`.                                |
| `pnpm build:prod` / `pnpm build` / `pnpm start`                    | `prod`.                               |
| `pnpm prisma:migrate`                                              | `dev`; runs `prisma migrate dev`.     |
| `pnpm prisma:deploy`                                               | `prod`; runs `prisma migrate deploy`. |
| `pnpm seed` / `pnpm seed:exams` / `pnpm storage:check:development` | `dev`.                                |

`:local` variants use the existing process environment without fetching Infisical. `build:local` and `dev:local` generate Prisma before their task. `prisma:generate`, lint, type checks, and tests also use the existing environment. Native Dotenv support remains in the code, but this repository supplies no `.env` or `.env.example`; there is no special `.env.local` loading in the backend.

Set `NODE_ENV=development` in `dev` and `NODE_ENV=production` in `prod`: an Infisical environment name does not replace Node's variable. `SEED_*` is separately validated when running the development seed.

For CloudFront signing, store the inline private key in Infisical or configure a path mounted by the deployment secret manager. A path value does not create a file. Set exactly one private-key source; never rely on deleted repository-local PEM files.

## Server and database

| Variable       | Required | Default       | Rule and purpose                                                                      |
| -------------- | -------- | ------------- | ------------------------------------------------------------------------------------- |
| `NODE_ENV`     | No       | `development` | `development`, `test`, or `production`; controls logs and some defaults.              |
| `PORT`         | No       | `3001`        | Integer 1–65535; HTTP port.                                                           |
| `LOG_LEVEL`    | No       | `info`        | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent`.                      |
| `DATABASE_URL` | Yes      | —             | Nonempty PostgreSQL connection string for the app, migrations, and integration tests. |

[Local Compose](../docker-compose.yml) fixes development user/database/password and exposes PostgreSQL 16 on `5444`. It does not read those settings from `DATABASE_URL`; client configuration must match the container. Its volume persists data across restarts.

```text
DATABASE_URL=postgresql://arxatec:arxatec@localhost:5444/arxatec_academy?schema=public
```

This is public development configuration, not a production credential. Integration must export a disposable database's `DATABASE_URL`; the current suite does not consume `TEST_DATABASE_URL`. [TESTING](TESTING.md) covers provisioning and cleanup.

`trust proxy` is fixed at one hop in `ServerPolicy`; there is no `TRUST_PROXY` variable. The schema also has no pool-budget or Argon2-queue variables.

## JWT identity and frontend

| Variable               | Required      | Default           | Rule and purpose                                                            |
| ---------------------- | ------------- | ----------------- | --------------------------------------------------------------------------- |
| `JWT_SECRET`           | Yes           | —                 | At least 32 characters; HS256 session and OAuth-state signing.              |
| `JWT_ISSUER`           | No            | `arxatec-academy` | Nonempty `iss` identifier.                                                  |
| `FRONTEND_URL`         | Yes           | —                 | Absolute URL; CORS origin, email links, certificates, and Google redirects. |
| `GOOGLE_CALLBACK_URL`  | Yes           | —                 | Absolute backend callback URL, even if Google is unused.                    |
| `GOOGLE_CLIENT_ID`     | To use Google | —                 | OAuth application identifier.                                               |
| `GOOGLE_CLIENT_SECRET` | To use Google | —                 | Backend OAuth secret.                                                       |

The local callback example is `http://localhost:3001/api/v1/auth/google/callback`; it must match Google's registration. Google credentials are optional at startup; the strategy is registered on use and fails explicitly if they are absent.

CORS derives one origin with `new URL(FRONTEND_URL).origin`; it does not read `ADMIN_ALLOWED_ORIGINS`. OAuth nonce cookies are HttpOnly, SameSite Lax, and Secure in production. Academy sessions are JWT Bearer tokens in JSON, not Admin-style session cookies.

Changing `JWT_SECRET` invalidates signed tokens. Never place it or database/SMTP/AWS credentials in `VITE_*`. Email frontend paths are defined in [endpoints](../src/constants/endpoints.ts): `/verificar-correo`, `/restablecer-contrasena`, and `/oauth/callback` for their respective flows.

## Email

| Variable          | Required    | Default              | Rule and purpose                                       |
| ----------------- | ----------- | -------------------- | ------------------------------------------------------ |
| `EMAIL_TRANSPORT` | No          | `smtp` outside tests | `smtp` in development/production; `log` only in tests. |
| `EMAIL_FROM`      | Yes         | —                    | Nonempty sender string.                                |
| `SMTP_HOST`       | With `smtp` | —                    | Nonempty SMTP host.                                    |
| `SMTP_PORT`       | No          | `587`                | Integer 1–65535.                                       |
| `SMTP_SECURE`     | No          | `false`              | Literal `true`/`false`; `true` enables direct TLS.     |
| `SMTP_USER`       | With `smtp` | —                    | Nonempty user.                                         |
| `SMTP_PASSWORD`   | With `smtp` | —                    | Nonempty password.                                     |

The schema requires host/user/password for SMTP and rejects `log` outside `NODE_ENV=test`. The sender must match `SMTP_USER` or an alias authorized by the provider. Academy may reuse Lawyer's SMTP server by configuring its credentials independently in each environment, never exposing them to the frontend. Nodemailer's `verify()` checks connection/authentication; actual delivery depends on the server and destination mailbox.

Registration tolerates delivery failures, preserves account/session, and returns `verification_email_sent: false` for immediate resending. Recovery starts delivery without waiting and protects the response with a timing floor. Password-change notifications log failure without undoing the change. There is no email queue or email worker.

## Storage

Validation lives in [storage_env](../src/config/storage_env.ts). With `STORAGE_DRIVER=s3`, product names take precedence over generic aliases:

| Product name                                  | Internal generic alias        |
| --------------------------------------------- | ----------------------------- |
| `S3_ACADEMY_PRODUCT_BUCKET`                   | `AWS_S3_BUCKET`               |
| `CDN_ACADEMY_PRODUCT_BASE_URL`                | `STORAGE_PUBLIC_URL`          |
| `CLOUDFRONT_ACADEMY_PRODUCT_KEY_PAIR_ID`      | `CLOUDFRONT_KEY_PAIR_ID`      |
| `CLOUDFRONT_ACADEMY_PRODUCT_PRIVATE_KEY`      | `CLOUDFRONT_PRIVATE_KEY`      |
| `CLOUDFRONT_ACADEMY_PRODUCT_PRIVATE_KEY_PATH` | `CLOUDFRONT_PRIVATE_KEY_PATH` |
| `CLOUDFRONT_SIGNED_URL_TTL_SECONDS`           | `CLOUDFRONT_URL_TTL_SECONDS`  |

With the local driver, product variables do not replace the `/files` URL. New covers/avatars use unsigned `/public/`; resources use `/private/` and signed URLs.

| Variable                      | Required              | Default                       | Rule and purpose                                                             |
| ----------------------------- | --------------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| `STORAGE_DRIVER`              | No                    | `local`                       | `local` or `s3`; both implemented.                                           |
| `STORAGE_LOCAL_PATH`          | No                    | `storage`                     | Persistent local directory.                                                  |
| `STORAGE_PUBLIC_URL`          | With `s3`             | `http://localhost:3001/files` | HTTPS CDN base without credentials, query, or fragment for S3.               |
| `AWS_REGION`                  | With `s3`             | —                             | Bucket region.                                                               |
| `AWS_S3_BUCKET`               | With `s3`             | —                             | Bucket name, not a domain.                                                   |
| `AWS_ACCESS_KEY_ID`           | No                    | —                             | Pair with secret, or omit both for IAM/default credential chain.             |
| `AWS_SECRET_ACCESS_KEY`       | With access key       | —                             | Always configure the complete pair.                                          |
| `AWS_SESSION_TOKEN`           | No                    | —                             | Temporary credential token.                                                  |
| `CLOUDFRONT_KEY_PAIR_ID`      | With `s3`             | —                             | Public key ID in the trusted group, not group/distribution ID.               |
| `CLOUDFRONT_PRIVATE_KEY`      | One source with `s3`  | —                             | Inline RSA 2048 PEM; escaped newlines supported.                             |
| `CLOUDFRONT_PRIVATE_KEY_PATH` | Alternative to inline | —                             | Private PEM file mounted outside the repository and readable by the process. |
| `CLOUDFRONT_URL_TTL_SECONDS`  | No                    | `300`                         | Integer 1–86400.                                                             |

With S3, configure exactly one PEM source. Startup rejects incomplete configuration, unreadable/invalid PEM, or non-RSA-2048 keys. There is no public fallback. `/private/*` must require signed URLs and use the trusted key group; `/public/*` allows unsigned reads. The S3 origin remains private with OAC. Operation failures return `503 STORAGE_UNAVAILABLE`.

The database stores canonical URLs and keys. Responses renew signatures from keys using the current domain without persisting temporary links. Keyless rows retain their original URL. Before changing drivers, migrate bytes under unchanged keys and review legacy rows. [STORAGE](STORAGE.md) covers permissions, expiration, caching, cleanup retries, and real checks.

## Video and administrative reporting

| Variable                       | Required      | Default                                                 | Rule and purpose                                                                    |
| ------------------------------ | ------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `VIDEO_PROVIDER_DRIVER`        | No            | `fake` outside production; `live` in production         | `live`, `fake`, or `vimeo`; `vimeo` is a legacy live-mode alias for both providers. |
| `VIDEO_PROBE_TIMEOUT_MS`       | No            | `3000`                                                  | Positive integer for the oEmbed timeout.                                            |
| `REPORTING_UTC_OFFSET_MINUTES` | No            | `-300`                                                  | Integer fixed reporting offset; Lima by default.                                    |
| `ADMIN_EXPORT_MAX_ROWS`        | No            | `50000`                                                 | Positive integer; user CSV limit.                                                   |
| `NOTIFICATIONS_IP_HASH_SALT`   | In production | `local-notifications-salt-change-me` outside production | At least 16 characters; production rejects the development default.                 |

The video default is determined at schema loading from `process.env.NODE_ENV`. YouTube requires no API key: the adapter uses oEmbed, which omits duration, so the editor must send positive seconds. Fake mode can still be explicitly selected in production; it does not verify real availability. Configure `live` for a release.

The reporting offset is not an IANA zone and does not adjust for daylight saving. At `-300`, the start of a Lima day is `05:00:00Z`. `ADMIN_EXPORT_MAX_ROWS` does not limit notification CSV. The salt hashes IPs in notification/topic records, not authentication session IPs; the application is not entirely free of clear IP storage.

## Development seed

| Variable                | Required for `pnpm seed` | Rule                                      |
| ----------------------- | ------------------------ | ----------------------------------------- |
| `SEED_ADMIN_EMAIL`      | Yes                      | Valid email for the test ADMIN account.   |
| `SEED_ADMIN_PASSWORD`   | Yes                      | At least 8 characters.                    |
| `SEED_STUDENT_EMAIL`    | Yes                      | Valid email for the test STUDENT account. |
| `SEED_STUDENT_PASSWORD` | Yes                      | At least 8 characters.                    |

The seed validates these values in [seed_env](../src/seed/seed_env.ts) without credential defaults and aborts in production. It updates seeded account passwords/roles and slug-identified content, deletes lessons outside the fixture in those courses, and rebuilds resources. It is not a production bootstrap tool or a load that preserves every local edit. Use only controlled development data.

It also inserts missing sample notification/topic requests without resetting notification states or incrementing existing counters again. The sample `automatiza-tus-escritos` exam deliberately uses A as every correct option for development flow checks; sample questions are not production exam content.

## Constants that are not environment variables

Session/token TTLs, cooldowns, rate limits, field/file limits, and error codes live in `src/constants`. Sessions have 30-day/12-hour inactivity windows and a 180-day absolute cap; resending waits 45 seconds. Changing these alters contracts and tests.

JSON limits, proxy trust, and shutdown watchdog live in `ServerPolicy`; do not document absent schema options as configurable. Adding a variable must update this guide, validation, Infisical configuration, and deployment instructions in the same release.
