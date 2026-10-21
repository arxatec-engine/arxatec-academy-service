# Data model and migrations

**Status:** domain-split schema and 14 migration directories. [Index](../README.md) · [Architecture](../../ARCHITECTURE.md).

This describes the working-tree schema, not applied state in a remote database.

## Client, ownership, and generation

[prisma.config.ts](../../../prisma.config.ts) selects prisma/schema, prisma/migrations, and seed. [_base.prisma](../../../prisma/schema/_base.prisma) generates a CommonJS client in src/generated. `pnpm prisma:generate` prepares it; build:local and Infisical builds generate before compiling. Prisma CLI, client, and adapter belong to the same service.

DATABASE_URL supplies the connection. Application/integration share the client module, so test isolation must be configured before import. There is no secondary reader, Admin tables, or Lawyer migrations.

## Tables and invariants

| Table                | Uniqueness and relations                            | Meaning                                                               |
| -------------------- | --------------------------------------------------- | --------------------------------------------------------------------- |
| users                | Unique email; cuid ID                               | STUDENT/ADMIN; nullable hash for Google accounts.                     |
| auth_sessions        | Session ID; user/expiration indexes                 | Sliding window, revocation, IP/user agent.                            |
| auth_tokens          | Unique token_hash; user/type index                  | Verification, reset, exchange; expiry/consumption.                    |
| oauth_accounts       | Unique provider/external ID                         | Google identity linked to Academy account.                            |
| courses              | Unique slug; state/order, topic, level indexes      | Draft/published/archived; service locks slug after first publication. |
| lessons              | Unique course/slug and course/position              | ARTICLE/VIDEO, publication, free sample.                              |
| lesson_resources     | Unique lesson/position                              | URL, optional key, MIME, and bytes.                                   |
| enrollments          | Unique user/course                                  | Start, retained closure date, referenced last lesson.                 |
| lesson_progress      | Unique user/lesson                                  | Maximum position and completion mark.                                 |
| certificates         | One user/course; UUID verification ID               | Issued recipient/course snapshots and optional passed attempt.        |
| course_exams         | Unique course                                       | Enabled/versioned questions and passing score.                        |
| exam_attempts        | Linked exam/user/course                             | Evaluated snapshot, answers, grade, and version.                      |
| teachers             | Reusable teacher identity                           | Name, biography, and optional external photo.                         |
| storage_deletions    | File key primary key; due-time index                | Durable cleanup attempts and worker leases.                           |
| comments             | Lesson/state/date, parent, user, moderation indexes | Roots/replies; visible, hidden, deleted states.                       |
| comment_reports      | Unique comment/reporter                             | Reason, review actor/date.                                            |
| notification_signups | Unique email/course plus partial null-course index  | Course/general catalog notifications.                                 |
| topic_requests       | Unique email/normalized term                        | Repeated request counts and latest time.                              |

One reply level, content validity, and editorial transitions are application rules, not universally SQL CHECK constraints. Most IDs are Prisma cuid except UUID certificates and explicit fixtures. Route schemas commonly require nonempty strings rather than UUIDs; use each resource's actual validator.

## Cascades and account deletion

Deleting users cascades sessions, tokens, OAuth, enrollments, progress, own reports, and linked notifications/topics. Comment authors and optional moderation actors use SetNull on direct user deletion.

`DELETE /me` does more: its transaction invokes deleteUserComments to physically delete owned comments/reports before deleting the user. Replies cascade, so deleting roots can remove other authors' replies. HTTP account deletion is not simple anonymization. See [account repository](../../../src/modules/user/shared/data/user_account.repository.ts) and [comments repository](../../../src/modules/comments/shared/data/comments.repository.ts).

Lesson deletion cascades resources, progress, and comments; enrollment last_lesson_id becomes null. Archiving a course does not delete it. Administrative lesson deletion requires draft state and confirmation for student data. SQL triggers queue detached file keys in the same transaction; actual object deletion follows commit after checking shared references.

## Migration history

| Migration                             | Change                                                |
| ------------------------------------- | ----------------------------------------------------- |
| 20260820203635_init                   | Users and authentication.                             |
| 20260821172841_modelo_de_contenido    | Courses, lessons, resources.                          |
| 20260821205134_progreso               | Enrollments and progress.                             |
| 20260821213652_comentarios            | Comments and reports.                                 |
| 20260821221319_perfil                 | Avatar key.                                           |
| 20260924174500_course_cover_key       | Cover key.                                            |
| 20260924180000_resource_file_key      | Resource key.                                         |
| 20260924181500_comment_moderation     | Review state, dates, actors.                          |
| 20260924183000_notifications          | Notifications, topics, general-catalog partial index. |
| 20260924190000_youtube_video_provider | YOUTUBE provider.                                     |
| 20261017160000_course_certificates    | Issued certificates.                                  |
| 20261017173000_course_exams           | Exams and attempts.                                   |
| 20261017213000_course_teachers        | Reusable teacher profiles.                            |
| 20261021030000_storage_deletions      | Cleanup queue and transactional detachment triggers.  |

The partial SQL index notification_signups_email_catalog_key handles course_id IS NULL; PostgreSQL's compound unique index does not deduplicate that null alone. Preserve this migration even when Prisma cannot express its complete definition. Likewise, db push does not install cleanup triggers.

## Verification and evolution

Regenerate after schema changes and apply versioned migrations to disposable data before integration. Development uses migrate dev; releases use migrate deploy. Never replace history with db push/reset or edit applied migrations to repair production data.

Test concurrent uniqueness, token consumption, monotonic progress, ordering, cascades, resource references, and cleanup leases with real PostgreSQL. Mocked object comparisons do not prove indexes/transactions. Future comment-retention policy must explicitly choose physical deletion versus anonymization before changing contracts.
