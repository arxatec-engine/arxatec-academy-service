# Testing and verification

Academy uses Jest 30, `@swc/jest`, and Supertest. Commands come from [package.json](../package.json). Code checks and `:local` variants do not query Infisical; operational commands use `dev` or `prod` as documented in [ENV](ENV.md). PostgreSQL tests write data and require a separate disposable environment.

## Release checks

From the service root with dependencies installed and explicit configuration:

```sh
pnpm prisma:generate
pnpm lint
pnpm typecheck
pnpm typecheck:tests
pnpm boundaries
pnpm docs:citations
pnpm test
pnpm test:integration:postgres
pnpm build:local
pnpm exec prettier --ignore-path /dev/null --check 'docs/**/*.md'
```

Run integration only after preparing the environment below. Markdown-only changes require formatting, links, and citations, not reseeding or product mutations. `.prettierignore` excludes Markdown by default; `--ignore-path /dev/null` includes it. Do not report commands as passed unless actually executed.

| Command                     | Checks                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `lint`                      | ESLint rules under `src`.                                                                  |
| `typecheck`                 | Runtime TypeScript without emitting files.                                                 |
| `typecheck:tests`           | Includes tests excluded from the runtime tsconfig.                                         |
| `boundaries`                | Cycles, private cross-module imports, and prohibited dependencies.                         |
| `docs:citations`            | Existence and range of `file:line` references, not Markdown links or semantic accuracy.    |
| `test`                      | `src/**/*.test.ts`, serially.                                                              |
| `test:integration:postgres` | `tests/integration/postgres/**/*.test.ts`, serially.                                       |
| `build:local`               | Prisma generation, CommonJS compilation, alias rewriting, and asset copying; no migration. |

## Unit and slice HTTP tests

Configuration is in [jest.config.cjs](../jest.config.cjs) and [jest.base.cjs](../config/jest/jest.base.cjs). Tests beside code cover schemas, pure policies, mappers, services with substituted collaborators, and controllers with real routers. Correctly mocked unit tests do not require a running PostgreSQL server.

Some imports load global configuration. Local environment files are not supplied; inject non-secret test values. A syntactically valid unused PostgreSQL URL does not start a database. For example, in a dedicated terminal:

```sh
export NODE_ENV=test
export DATABASE_URL='postgresql://academy_test:academy_test@127.0.0.1:1/academy_unit_test'
export JWT_SECRET='academy-test-only-secret-at-least-32-characters'
export FRONTEND_URL='http://localhost:5173'
export GOOGLE_CALLBACK_URL='http://localhost:3001/api/v1/auth/google/callback'
export EMAIL_FROM='Academy Tests <no-reply@example.test>'
export EMAIL_TRANSPORT=log
export VIDEO_PROVIDER_DRIVER=fake
export STORAGE_DRIVER=local
export LOG_LEVEL=silent
pnpm test
```

For a focused check:

```sh
pnpm test --runTestsByPath src/modules/courses/shared/test/lesson_access.test.ts
pnpm test --runTestsByPath src/utils/test/csv.test.ts
```

SWC transforms tests but does not replace type checking. Mock the exact specifier imported by implementation; a different barrel can initialize Prisma or leave a real dependency active. Never use real credentials to satisfy mocks.

## Preparing integration PostgreSQL

The suite **does not consume `TEST_DATABASE_URL`** and most files do not guard against a development database. It imports the application client reading `DATABASE_URL`. Setting only `TEST_DATABASE_URL` does not isolate tests.

Provision a disposable database, for example `arxatec_academy_test`, with a role allowed to migrate and write fixtures. Compose creates `arxatec_academy`, not that second database. In a dedicated terminal, replace the example connection with your disposable database:

```sh
export NODE_ENV=test
export DATABASE_URL='postgresql://test_user:test_password@127.0.0.1:5444/arxatec_academy_test?schema=public'
export JWT_SECRET='academy-test-only-secret-at-least-32-characters'
export JWT_ISSUER='arxatec-academy'
export FRONTEND_URL='http://localhost:5173'
export GOOGLE_CALLBACK_URL='http://localhost:3001/api/v1/auth/google/callback'
export EMAIL_FROM='Academy Tests <no-reply@example.test>'
export EMAIL_TRANSPORT=log
export VIDEO_PROVIDER_DRIVER=fake
export STORAGE_DRIVER=local
export STORAGE_LOCAL_PATH="$(mktemp -d /tmp/academy-test-storage.XXXXXX)"
export SEED_ADMIN_EMAIL='admin-seed@example.test'
export SEED_ADMIN_PASSWORD='academy-test-admin-2026'
export SEED_STUDENT_EMAIL='student-seed@example.test'
export SEED_STUDENT_PASSWORD='academy-test-student-2026'
pnpm prisma:generate
pnpm exec prisma migrate deploy
pnpm seed:local
pnpm test:integration:postgres
```

These passwords are public fixtures for disposable data. Seed is necessary because progress, comments, and account tests look up `fundamentos-de-legal-tech` and its lessons. It is not purely additive: it updates users/courses and reconstructs resources.

An empty database receives 36 users (one administrator and 35 students), six courses, and 55 YouTube video lessons. `fundamentos-de-legal-tech` has 30 lessons. Videos reuse three public sample clips to test playback; lesson titles/durations describe sample classes. Two previous articles remain as transcripts. The 34 extra students use `@seed.arxatec.test` addresses and `SEED_STUDENT_PASSWORD`, with Lima, Arequipa, and Trujillo profiles, independent workers, and different firms. The directory exceeds the default 25-user page.

Notifications include 60 subscriptions: 30 general and 30 across the six courses, split into 30 pending/30 notified. They involve 24 students and six visitors (`visitante01@seed.arxatec.test` through `visitante06@seed.arxatec.test`). There are also 50 requests grouped into ten topics, with multiple emails and counts. These support filtering, pagination, CSV, marking, and deletion review. Notification seeding inserts only missing rows and preserves states/counts, recognizing general signups by email even with null `course_id`.

The seed also creates 545 threads and 1788 replies, including team interventions, student discussions, and unanswered questions. Stable comment IDs prevent duplicates on rerun and retain manually added comments in lessons that remain in the syllabus.

Comment cleanup deletes comments from selected fixture lessons, and some flows temporarily change seeded course state. Tests do not necessarily delete only their own user. Never run this suite against student content or a shared database. Remove the disposable database and temporary files afterward using the provisioning procedure; never reset the normal connection.

## Current integration coverage

| File under `tests/integration/postgres` | Behavior                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `auth_flow.test.ts`                     | Registration, verification/repeated click, repeated sign-out, sign-in, reset/revocation, and hash exclusion. |
| `progress_flow.test.ts`                 | Repeated enrollment, concurrent maximum position, completion/unmarking, and syllabus changes.                |
| `comments_flow.test.ts`                 | Verified posting, public authors without email, team badge, reports, visibility, and rate limits.            |
| `account_flow.test.ts`                  | Profile, passwords/other sessions, avatar, summary, and transactional deletion.                              |
| `admin_access_control.test.ts`          | Administrative route matrix without sessions and with STUDENT.                                               |
| `admin_courses_flow.test.ts`            | Drafts, stale autosave, publication, slugs, duplication, and archiving.                                      |
| `admin_lessons_flow.test.ts`            | ARTICLE/VIDEO editing, resources, publication, order, and confirmations.                                     |
| `admin_moderation_flow.test.ts`         | Team replies, reports, and states observed through the public API.                                           |
| `admin_users_flow.test.ts`              | Directory filters and exports.                                                                               |
| `notifications_flow.test.ts`            | Deduplication, grouped demand, CSV, marking, and deletion.                                                   |
| `teachers_flow.test.ts`                 | Teacher assignment/editing, course duplication, and stale updates.                                           |
| `certificates_flow.test.ts`             | Completed lessons, exams, issuance, public certificates, and PDF.                                            |
| `storage_cleanup_flow.test.ts`          | Cascades, shared files, replacements, persistent retries, worker leases, and rollback.                       |

File presence does not establish execution on a specific machine. Record command, non-sensitive environment, result, and limits in [shipped](shipped/README.md). Mocked email and fake video do not certify SMTP, Google, or real playback.

## Compiled-server smoke test

[smoke_backend.sh](../scripts/smoke_backend.sh) starts `dist/server.js`, uses `curl`/`jq`, creates temporary account/course/files, and exercises public, student, and administrative surfaces. It needs a migrated/seeded disposable database, `curl`, `jq`, `rg`, Node, and pnpm. Build and run against the same test `DATABASE_URL`:

```sh
pnpm build:local
SMOKE_ALLOW_MUTATION=1 VIDEO_PROVIDER_DRIVER=fake bash scripts/smoke_backend.sh
```

The default port is 3109 (`SMOKE_PORT` overrides it). The script uses `SEED_ADMIN_*`, temporarily stores logs to recover verification tokens, and cleans artifacts on exit. `SMOKE_ALLOW_MUTATION=1` is an explicit stop, not proof of database identity. Never publish logs or run this check against production.

## Exam seed

The full seed includes a 15-question exam for each of six sample courses. `pnpm seed:exams` adds only missing exams for those existing courses without reseeding users, lessons, or comments. It is idempotent and preserves saved versions/configuration. The automation sample deliberately uses all A answers for development. See [seed](../src/seed/docs/README.md).

`src/seed/test/seed_exams.test.ts` checks data and grading. The completed-lessons/exam/certificate/PDF HTTP flow is in `tests/integration/postgres/certificates_flow.test.ts`; run it only against disposable data.
