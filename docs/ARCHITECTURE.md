# Architecture — Arxatec Academy Service

Academy is a REST learning API built with Express 5, strict TypeScript, Zod, PostgreSQL through Prisma 7, and Pino. Catalog, lessons, student identity, progress, community, and content administration share one process. Documentation follows Admin's organization while implementation retains Academy's contracts.

## 1. Stack and product boundaries

| Layer                | Implementation                                                           |
| -------------------- | ------------------------------------------------------------------------ |
| Runtime and packages | Node.js >=22.12; pnpm pinned in `packageManager`.                        |
| HTTP                 | Express 5, Helmet, CORS, cookie-parser, and Multer.                      |
| Language and build   | Strict TypeScript, CommonJS, `@/` aliases, `tsc`, and `tsc-alias`.       |
| Persistence          | Prisma 7 with `@prisma/adapter-pg`, PostgreSQL, and domain-split schema. |
| Validation           | Zod inputs, explicit policies, and mappers.                              |
| Authentication       | HS256 JWTs, persisted sessions, Passport Google OAuth 2.0.               |
| Passwords and tokens | Argon2id, random tokens, and SHA-256 for single-use tokens.              |
| Email                | Nodemailer SMTP in development/production; log transport only in tests.  |
| Files                | Storage port, local adapter, and S3 with signed CloudFront delivery.     |
| Cleanup              | PostgreSQL-backed deletion queue and in-process retry worker.            |
| Video                | oEmbed port with Vimeo, YouTube, and fake adapters.                      |
| Tests                | Jest, SWC, Supertest, and real PostgreSQL integration tests.             |

Academy owns its database and STUDENT/ADMIN product roles. It has no workspaces, multi-tenant memberships, credits, billing, or read connection to Lawyer. Startup does not include Redis, BullMQ, Socket.IO, or external cron. The storage cleanup worker runs inside the backend process.

## 2. Repository map

```text
src/
├── server.ts                    # HTTP, resource registration, and orderly shutdown
├── app/create_app.ts            # Express composition
├── config/                      # environment, logger, Prisma, email, and Passport
├── constants/                   # endpoints, policies, codes, messages, and i18n keys
├── generated/                   # generated Prisma client; do not edit
├── infrastructure/
│   ├── email/                   # delivery port, links, and templates
│   ├── jwt/                     # session token signing and validation
│   ├── password/                # Argon2id
│   ├── tokens/                  # opaque tokens and hashing
│   ├── storage/                 # port, validation, adapters, and durable cleanup
│   └── video/                   # probes and provider adapters
├── middlewares/                 # identity, permissions, limits, uploads, and errors
├── modules/
│   ├── auth/                    # registration, login, sessions, reset, verification, Google
│   ├── courses/                 # catalog, reading, and course/lesson editing
│   ├── progress/                # enrollment, progress, My courses, exams, certificates
│   ├── comments/                # threads, replies, reports, and moderation
│   ├── user/                    # profile, account, directory, and CSV
│   └── notifications/           # notifications, topics, and administration
├── routes/index.ts              # composition under /api/v1
├── seed/                        # development fixtures
├── types/                       # identity and Express extensions
└── utils/                       # responses, errors, CSV, dates, and normalization

prisma/schema/                   # base, enums, domain models, and cleanup queue
prisma/migrations/               # Academy SQL history, including cleanup triggers
config/jest/                     # shared and integration configuration
tests/integration/postgres/      # cross-module flows against a real database
scripts/                        # documentation citation checks and HTTP smoke tests
docs/                           # guides, area scope, and releases
```

## 3. Startup and HTTP chain

[createApp](../src/app/create_app.ts) assembles these components in order:

| Order | Component                       | Purpose                                             |
| ----- | ------------------------------- | --------------------------------------------------- |
| 1     | `trust proxy = 1`               | Resolve client IP for a single trusted proxy hop.   |
| 2     | Helmet and request ID           | Headers and correlation before responses.           |
| 3     | cookie-parser, logger, and CORS | OAuth state, HTTP logging, and frontend origin.     |
| 4     | JSON and urlencoded, 1 MiB each | Parse bodies before email-aware limits.             |
| 5     | Passport initialize             | Enable Google without Passport sessions.            |
| 6     | `GET /ping`                     | Check HTTP responsiveness without a database query. |
| 7     | `/files`                        | Serve public files with the local driver.           |
| 8     | Routers                         | Public, student, and administrative routes.         |
| 9     | 404 and error handler           | Translate errors into the shared HTTP contract.     |

CORS derives one origin from `FRONTEND_URL`; it does not replace Bearer authentication or `requireAdmin`. Static file middleware does not authenticate downloads. The Google strategy is registered on use and fails if its credentials are absent, without blocking password sign-in at startup.

[server.ts](../src/server.ts) registers email, Prisma, storage cleanup, and HTTP as closeable resources. SIGTERM/SIGINT close them in reverse order: HTTP, cleanup, Prisma, then email, with a 10-second watchdog. Unhandled exceptions also trigger shutdown. There is no PostgreSQL-aware readiness route or database check before `listen`.

## 4. Slices and responsibilities

```text
modules/<module>/features/<feature>/<action>/
├── domain/          # Zod schema, payload, types, and local rules
├── data/            # owned persistence, where needed
├── presentation/    # routes, controller, and service
├── docs/README.md   # contract, rationale, invariants, and evidence
├── test/            # unit tests
└── utils/           # only helpers belonging to this action
```

The flow is `router → middleware → controller → schema → service → repository → Prisma`. Controllers know Express and construct responses; services accept typed data and apply rules; repositories select columns and write; pure policies define reusable decisions. Email, storage, and video integrations live behind ports.

Authentication, catalog reading, progress, and profile separate actions. Administrative features and notifications still group multiple actions in presentation files; they are implemented with structural debt, not fully separated.

| Shared scope                          | Location                      | Example                                                      |
| ------------------------------------- | ----------------------------- | ------------------------------------------------------------ |
| One action                            | The action itself             | Dummy login hash, recovery timing floor.                     |
| Multiple actions in a domain          | `modules/<module>/shared`     | Sessions, course references, progress repository.            |
| Cross-cutting infrastructure          | `infrastructure`              | Email delivery, local files, external probes, cleanup queue. |
| Helpers without module business logic | `utils`, `constants`, `types` | HTTP envelope, CSV, error codes.                             |

Dependency-cruiser checks cycles, cross-module private imports, runtime-to-test dependencies, constants-to-runtime dependencies, and utils-to-module dependencies. It does not prove every design rule; for example, there is no general rule detecting every Express usage inside a service.

## 5. Identity and sessions

JWTs include `sub`, `jti`, `role`, `iat`, `exp`, and `iss`. HS256 validates the bearer, but every authenticated request reads `auth_sessions` and its user. The service checks `sub`/user matching, revocation, and expiration. Effective roles and email verification come from PostgreSQL, so stale claims cannot preserve removed access.

Inactivity windows are 30 days with `remember_me=true` and 12 hours with `false`. Required authentication renews at most once every five minutes. JWTs expire 180 days after creation; sliding windows never exceed that cap. `optionalAuthenticate` recognizes valid sessions without renewing them; invalid Bearer tokens are treated as anonymous on those routes.

Sign-out uses an authenticator that tolerates revoked sessions so closure can be repeated. Reset consumes the token, changes the password, verifies missing email verification, and revokes every session in one transaction. Profile password changes retain the current session and revoke others.

Verification, reset, and Google exchange secrets are stored hashed and consumed by a conditional unused-token write. Google uses signed state and a nonce cookie, redirecting a 60-second opaque code to the frontend, never a JWT in the URL.

## 6. Content, access, and publication

The catalog queries only published courses. Course details present metadata and published syllabus, including `lesson.id`; open lessons return video/article, transcript, and resources. Guests can read a free sample; signed-in users can read published lessons without enrollment or verified email. Locked content returns `403 LESSON_LOCKED` with public metadata without reading open content. Drafts and archived courses are not exposed through public slug reads.

The administrative editor uses different selects and requires ADMIN. Course autosave uses `expected_updated_at`; first publication sets `published_at` and locks the slug. Ordering writes a complete active-ID set. Publication requires a published lesson and both descriptions. Archiving removes courses from the catalog without deleting progress or files; duplication copies drafts.

Lessons separate VIDEO/ARTICLE. Changing type clears incompatible columns and may require confirmation. The server sanitizes HTML and calculates words/minutes; published lessons that become incomplete return to draft. Vimeo supplies duration; YouTube requires a positive manual duration because oEmbed omits it. See [lessons](planning/lessons/README.md).

## 7. Persistence and transactions

[prisma.config.ts](../prisma.config.ts) declares `prisma/schema`, migrations, and seed. The generated client uses CommonJS under `src/generated`. A single `PrismaPg` has no explicit pool/query/admission budget equivalent to Admin's.

The [data map](planning/data_model/README.md) documents indexes, relations, and cascades. Progress guarantees one row per user/lesson, inserts with conflict ignored, and updates only when playback position increases. Completion groups marking, enrollment, and first closure in one transaction. Its pure completion rule is invoked from the repository within that transaction so the decision stays at write time.

Account deletion shares a transaction client when deleting progress, owned comments, authentication artifacts, and the user. The avatar is cleaned afterward. Other modules are consumed through `shared`; calling a global client inside that flow would lose atomicity.

File detachment is captured by database triggers into `storage_deletions` in the same transaction, including cascading deletes and cover/avatar replacements. Storage deletion happens after commit, with reference checks, leases, and persistent retries. Apply the SQL migration; schema synchronization alone does not install triggers. See [storage](STORAGE.md).

Authentication still has several actions managing `auth_tokens` through their own repositories. Consolidation must preserve single consumption, transactional boundaries, and mocks targeting those exact paths.

## 8. Community, users, and notifications

Public threads have one reply level and authors without email addresses. Team badges derive from current roles. Public comments/replies require a session and verified email; reports require a session and deduplicate by user/comment. Hiding a root removes its thread from public projections. Moderation retains state, actors, and dates without introducing Admin's generic auditing system.

Profile modifies permitted fields, excluding email and role. Directory projections include identity and course closures, filters, and CSV. Global statistics are not restricted by search. Pagination lives in `meta.pagination`, while moderation and notifications return it inside `data`.

Notifications accept anonymous email or session email. A migration adds a partial index for general notifications with `course_id IS NULL`; the compound unique index alone is insufficient. Topic requests aggregate normalized demand. Marking notified sends no email. IPs in these tables are stored as salted hashes.

## 9. Errors, logs, and files

`buildHttpResponse` returns status, message, description, timestamp, and path, with optional data/meta. `AppError` adds a stable code and optional confirmation details. Zod becomes `422 VALIDATION_ERROR` with i18n keys; unexpected errors become `500 INTERNAL_ERROR`. CSV, OAuth, and `204` have specific transports. See [API](API.md) for details and exceptions.

Pino serializes requests without query strings and responses without headers to keep OAuth codes out of HTTP logs. Log email transport is test-only and includes email text; treat that log as sensitive. Development and production require SMTP.

Files are validated by usage, MIME, signature, and size. The local driver serves public URLs; S3 uses a private origin and signed CloudFront URLs where required. The database stores canonical URLs and internal keys; keyed rows resolve against the current base URL. API responses use `private, no-store`. Resource authorization occurs before signing. See [STORAGE](STORAGE.md).

## 10. Verification and evolution

[TESTING](TESTING.md) defines commands and PostgreSQL isolation: integration uses `DATABASE_URL` and seeded disposable data. [PERFORMANCE](PERFORMANCE.md) documents searches/exports that materialize entire sets without inventing measurements.

Changes must keep contracts, area READMEs, [decisions](DECISIONS.md), relevant environment documentation, and [release notes](shipped/README.md) consistent. Production review retains explicit follow-up; complete documentation does not imply that operational work has been verified.
