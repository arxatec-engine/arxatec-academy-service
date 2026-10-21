# Backend delivery and verification

**Status:** the working tree contains implemented product modules. This document organizes
verification and remaining work; it does not reconstruct a historical release or certify
production. [Index](../README.md) · [Testing](../../TESTING.md).

## Dependencies and verifiable areas

| Area                 | Existing implementation                                           | Required evidence                                                    |
| -------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------- |
| Foundation           | Configuration, errors, Prisma, migrations, lifecycle              | Successful startup and shutdown without live resources               |
| Identity             | Registration, sessions, email, reset, Google                      | Safe user DTOs, revocation, secure exchange                          |
| Public content       | Catalog, facets, course details, lessons                          | Published visibility, sample/session access, navigation              |
| Learning             | Enrollment, progress, completion, My courses, exams, certificates | Uniqueness, concurrent progress, syllabus changes, server grading    |
| Community/account    | Threads, reports, profile, password, deletion                     | Verified writes, isolation, persisted cleanup                        |
| Editor               | Courses, lessons, resources, video                                | Authorization, conflicts, real state transitions                     |
| Editorial operations | Moderation, directory/CSV, notifications, topics                  | Review, filters, CSV formula neutralization, marking without sending |

These are functional dependencies, not Admin's inherited P0–P4 phases. Each area's checklist
links to its own code and tests.

## Environments and fixtures

Integration tests require an explicit `DATABASE_URL` for a disposable migrated database.
`TEST_DATABASE_URL` is not consumed. The seed prepares the expected catalog but rewrites its
fixtures; comments and progress tests also mutate those records. Do not use a shared development
database containing review data or a production database.

| Fixture                                                     | Check                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------- |
| Unverified STUDENT and persisted ADMIN                      | Session/role access; verification only where required   |
| Existing/unknown email and Google account without a hash    | Defined responses without accidental hash exposure      |
| DRAFT/PUBLISHED/ARCHIVED course                             | Visibility and transitions                              |
| Sample, article, video from both providers                  | Access, sanitization, duration, incompatible fields     |
| Out-of-order positions and simultaneous writes              | Maximum progress and unique constraints                 |
| Completed course with newly added content                   | Current state distinct from persisted completion date   |
| Root, reply, deleted author, changed role, reports          | Public projection and moderation counts                 |
| Users at Lima day boundaries and formula-like CSV values    | Filters, dates, cell neutralization                     |
| General/course subscriptions and repeated normalized topics | Partial index, uniqueness, demand metrics               |
| Duplicated resource shared across records                   | Keep bytes while any reference remains                  |
| Failed and passing exam attempts                            | Version checks, retry behavior, idempotent certificates |
| Failed storage deletion                                     | Durable retry and eventual cleanup                      |

## Functional release checks

Follow [TESTING](../../TESTING.md): lint, application/test types, boundaries, citations, unit
tests, isolated PostgreSQL, build, and formatting. Builds generate Prisma before compilation.
Run compiled-server smoke checks only against a disposable database with the script's explicit
mutation permission. Record commands actually executed; inspecting a test file is not a pass.

Operational verification adds real SMTP, Google, and video providers, URLs from the final
origin, persistent files, and signal-based shutdown. Network doubles validate rules but do
not certify external integrations.

## Remaining work and completion criteria

| Work                                    | Concrete completion criterion                                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Split administrative actions            | Preserve routes/DTOs, add action README/tests, pass boundaries                                                                     |
| Consolidate shared tokens               | Preserve single consumption and transactions; update mocks to actual module specifiers                                             |
| Verify target S3/CloudFront environment | Validate real permissions, shared-reference cleanup, and file migration; development evidence already exists                       |
| Verify private CDN access               | Require signatures in CDN behaviors; reject missing/tampered/expired signatures, including cached objects; verify frontend renewal |
| Bound growing queries                   | Consistent search/pagination, measured exports, agreed limits                                                                      |
| Default integration isolation           | Dedicated test connection and runner guards without writes to a normal database                                                    |
| Define initial production ADMIN         | Authorized procedure without public elevation or demo seeding                                                                      |
| Failed OAuth return                     | Shared frontend/backend contract tested for cancellation and provider failures                                                     |
| Production release                      | Actual checks, target migrations, configuration, controlled smoke evidence                                                         |

This is future work, not an instruction to implement unrelated features during documentation
maintenance. Priorities depend on the release and measured production needs.

## Resource measurements and documentation

Measure latency, RSS, and connections in the compiled process with representative catalogs,
directories, uploads, and concurrent login. Academy does not inherit Admin's pool/Argon2 budget.
Review queries, indexes, buffers, and contract semantics before adding infrastructure.

Update each affected unit's README, API, environment guide, and decisions as needed. Record
intent, changes, evidence, and remaining work in [shipped](../../shipped/README.md). Identify
documentation deliveries as such; describing future product work does not complete it.
