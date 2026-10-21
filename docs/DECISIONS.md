# Academy Service decisions

These decisions describe current behavior. Production state and test evidence live in [PRODUCTION_READINESS](PRODUCTION_READINESS.md) and [shipped](shipped/README.md); checks are not inherited from Admin Service.

| Decision                                      | Status                              | Rationale and consequence                                                                                                                                                        |
| --------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-001 · Modular API in one process            | In use                              | Express 5, strict TypeScript, and vertical slices share startup, errors, and persistence without a process per screen.                                                           |
| D-002 · Email without a queue                 | In use                              | Registration retains accounts after SMTP failure and returns `verification_email_sent: false` for resending; recovery starts delivery without waiting.                           |
| D-003 · Academy-owned database                | In use                              | Users, content, and learning belong to this product; Prisma migrates only its PostgreSQL.                                                                                        |
| D-004 · JWT with persisted sessions           | In use                              | JWT identifies the session; PostgreSQL determines revocation, expiration, and current role.                                                                                      |
| D-005 · Single-use opaque tokens              | In use                              | Verification, reset, and OAuth exchange store SHA-256; clear secrets travel only to their recipients.                                                                            |
| D-006 · Verification required for comments    | In use                              | Signed-in lesson access, enrollment, and progress do not require email verification; public comments and replies do.                                                             |
| D-007 · Public slugs and operational IDs      | In use                              | Public links use slugs; progress, comments, and the editor use IDs. Syllabuses expose `lesson.id` for those operations.                                                          |
| D-008 · Derived totals                        | In use                              | Duration and progress use published lessons; no copied total needs synchronization.                                                                                              |
| D-009 · Monotonic progress                    | In use                              | Late playback events cannot decrease `last_position_seconds`; PostgreSQL enforces the guard.                                                                                     |
| D-010 · Separate public and editorial content | In use                              | Editors can read drafts; public repositories filter publication and separate locked/open lessons.                                                                                |
| D-011 · Storage behind a port                 | Local and S3/CloudFront implemented | Validate MIME, signatures, and size; persist canonical URLs and supply temporary signed CDN reads. Local files remain public.                                                    |
| D-012 · Notifications without bulk delivery   | In use                              | Subscriptions, demand aggregation, and cutoff marking are data operations; marking sends no email.                                                                               |
| D-013 · Exam-based certificates               | In use                              | Passing the server-graded exam issues one certificate per student/course in the same transaction as the attempt. Issued data is retained and publicly verifiable by UUID and QR. |
| D-014 · Durable file cleanup                  | In use                              | Transactional database triggers capture detached keys; immediate cleanup and a retry worker delete unused objects while preserving shared references.                            |

## Sessions and account discovery

HS256 JWTs have an absolute 180-day cap. Session rows have inactivity windows of 30 days or 12 hours, refreshed at most every five minutes during required authentication. Signing a JWT with only the initial sliding expiration would evict active users after their row had been renewed. The [session policy](../src/modules/auth/shared/policy/session_policy.ts) caps renewal at the same absolute limit.

Sign-out recognizes already-revoked sessions so closure can be repeated. Password reset revokes every session; changing a password from Profile revokes the others and retains the current one. ADMIN is read from the persisted user, preventing stale claims from preserving removed permissions.

Unknown-email and wrong-password sign-in share a response and perform Argon2 verification; Google accounts without passwords return the explicit `ACCOUNT_USES_GOOGLE` conflict. Recovery uses the same response for known/unknown emails with a 400 ms floor. This reduces discovery signals without claiming mathematically constant timing.

## Catalog and learning

Each facet applies other filters and omits its own; search does not alter counters. Normalized catalog search runs in memory because the current list is not paginated. Catalog growth requires moving filtering and pagination together into PostgreSQL.

A completed course requires at least one published lesson and completion of every published lesson. The first closure date is retained; new content may return a course to “in progress.” Directory and personal-summary counters count persisted closure dates, which differs from being up to date. See [metrics](planning/metrics/README.md).

Lesson completion and certification are separate steps. New certificates require passing 15 questions, initially 12 correct answers (80%), configurable per course in administration. Grading runs on the server, and the passed attempt is stored with the certificate. Versions protect against question changes during an attempt; snapshots preserve what was evaluated. Earlier certificates remain valid. See [exams](../src/modules/progress/features/exams/docs/README.md).

## Editorial writes and traceability

Course autosave compares `expected_updated_at`; first publication locks the slug through `published_at`. Archiving preserves progress and stored files. Duplication creates drafts and may share resource references. Lesson editing confirms type changes that discard content, sanitizes articles, and unpublishes edits that become incomplete.

Moderation retains status, dates, and actors on comments/reports and emits operation logs. Academy does not have Admin's capability tables, generic audit trail, or command receipts. Reference-repository features do not imply idempotency keys or optimistic control for every Academy command.

## Resources and known follow-up

There is no Redis, BullMQ, Socket.IO, or external scheduler. An in-process storage cleanup worker starts with the server and recovers persisted jobs every 30 seconds. Rate limits remain process-local. Prisma does not fix a two-connection pool, and Argon2 lacks Admin's bounded queue. Measure concurrency before importing another service's resource budgets.

Remaining work includes production-environment validation of S3/CloudFront, splitting grouped administrative actions, an authorized initial-ADMIN procedure, and real video/email/storage verification for the release. Development evidence does not certify production. Criteria are in [delivery](planning/delivery/README.md).
