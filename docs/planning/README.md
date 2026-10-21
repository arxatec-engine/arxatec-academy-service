# Academy Service scope and planning

**Status:** all six business modules have implementations and registered routes. This space retains rules, sources, contracts, acceptance criteria, and explicit follow-up. “Implemented” describes inspected code; [production readiness](../PRODUCTION_READINESS.md) and [delivery](delivery/README.md) distinguish execution evidence from operational work.

Academy owns PostgreSQL identity, sessions, catalog, learning, community, and notifications. Its editorial panel uses Academy ADMIN users. It neither consumes Admin's cookie nor queries a Lawyer database for these screens.

## Implemented areas

| Code area                             | Main surface under `/api/v1`                                           | Documented scope                                                                |
| ------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `auth`                                | `/auth`                                                                | [Registration, sessions, verification, reset, and Google](auth/README.md)       |
| `courses/catalog`                     | `/courses`                                                             | [Catalog, facets, course details, and editing](courses/README.md)               |
| `courses/lessons` and `admin_lessons` | `/courses/:course_slug/lessons/:lesson_slug`, `/admin/lessons`         | [Access, articles, videos, and resources](lessons/README.md)                    |
| `progress`                            | `/courses/:slug/enroll`, `/lessons/:lesson_id/progress`, `/me/courses` | [Enrollment, progress, completion, exams, and certificates](progress/README.md) |
| `comments`                            | `/lessons/:lesson_id/comments`, `/comments`, `/admin/comments`         | [Threads, reports, and moderation](comments/README.md)                          |
| `user`                                | `/me`, `/admin/users`                                                  | [Profile, account, summary, directory, and export](users/README.md)             |
| `notifications`                       | `/notifications`, `/admin/notifications`                               | [Notifications and topic demand](notifications/README.md)                       |

Each area links actual schemas/repositories. Course/lesson editorial routes belong to `courses`, not a seventh service or another Admin actor.

## Cross-cutting contracts

- [Data and migrations](data_model/README.md): relations, uniqueness, cascades, and clients.
- [HTTP contracts](http_contracts/README.md): conventions, pagination, examples, and errors.
- [Metrics](metrics/README.md): totals, dates, current state, and coverage.
- [Permissions and traceability](permissions_audit/README.md): real identity, allowed fields, and limits.
- [Files](storage/README.md): local storage, signed S3/CloudFront, cleanup, and operational validation.
- [Endpoint reuse](endpoint_reuse/README.md): what students, catalog, and editorial tools share.
- [Delivery and verification](delivery/README.md): dependencies, fixtures, and completion criteria.

## Persistence sources

| Schema                                                    | Academy-owned data                                    |
| --------------------------------------------------------- | ----------------------------------------------------- |
| [users](../../prisma/schema/users.prisma)                 | Profile, role, credentials, verification, and avatar. |
| [auth](../../prisma/schema/auth.prisma)                   | Sessions, single-use tokens, and OAuth accounts.      |
| [courses](../../prisma/schema/courses.prisma)             | Courses, lessons, and resource metadata.              |
| [progress](../../prisma/schema/progress.prisma)           | Enrollments, lesson progress, and certificates.       |
| [exams](../../prisma/schema/exams.prisma)                 | Versioned exams and attempt snapshots.                |
| [teachers](../../prisma/schema/teachers.prisma)           | Reusable teacher profiles.                            |
| [storage](../../prisma/schema/storage.prisma)             | Persisted file-deletion jobs.                         |
| [comments](../../prisma/schema/comments.prisma)           | Threads, reports, and moderation actors.              |
| [notifications](../../prisma/schema/notifications.prisma) | Signups and topic requests.                           |
| [enums](../../prisma/schema/enums.prisma)                 | Roles, cities, content, and states.                   |

This inventory describes queryable data, not active-user counts or remote database state. A Prisma field is not automatically part of the API.

## Organization and resources

Apply [architecture](../ARCHITECTURE.md) and [style](../CODE_STYLING.md): controllers own HTTP, services own rules, repositories own persistence, and `shared` is the inter-module surface. Grouped administrative features retain per-action separation debt.

Do not add workspaces, billing, AI, or Lawyer metrics merely by copying Admin's index. Academy focuses on learning and editing. Resource decisions differ too: there is no bounded pool or application-owned Argon2 queue. [Performance](../PERFORMANCE.md) identifies materializing searches/exports without attributing nonexistent optimizations.

## Follow-up beyond implemented scope

Production S3/CloudFront validation remains an operational task even though signed private delivery and durable cleanup are implemented and development-tested. Bulk email, granular capabilities, general auditing, command receipts, and retention/presence metrics have no implemented operational contract. Additions require data, permissions, tests, and frontend coordination; roadmap entries alone are not available features.
