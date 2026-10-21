# Arxatec Academy Service documentation

Academy is Arxatec's learning backend: public catalog, video/article lessons, student accounts, progress, comments, and editorial administration. This documentation follows the organization of [Admin Service](../../../arxatec-admin/arxatec-admin-service/docs/README.md) while describing Academy's own contracts and implementation limits.

## General guides

| Document                                        | Contents                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| [Architecture](ARCHITECTURE.md)                 | Startup, modules, responsibilities, persistence, and slice boundaries.     |
| [Code style](CODE_STYLING.md)                   | Naming, TypeScript, imports, validation, responses, and documentation.     |
| [Decisions](DECISIONS.md)                       | Product rules, alternatives, and consequences of technical decisions.      |
| [HTTP contract](API.md)                         | Public, student, and administrative routes; bodies, responses, and errors. |
| [Environment](ENV.md)                           | Variables, defaults, optional dependencies, and seed configuration.        |
| [Performance](PERFORMANCE.md)                   | Queries, memory, limits, and areas requiring measurement.                  |
| [Testing](TESTING.md)                           | Actual commands, fixtures, disposable PostgreSQL, and HTTP smoke tests.    |
| [Deployment](DEPLOYMENT.md)                     | Installation, Prisma generation, migrations, execution, and shutdown.      |
| [Files](STORAGE.md)                             | Covers, resources, and avatars; local and signed S3/CloudFront delivery.   |
| [Production readiness](PRODUCTION_READINESS.md) | Available evidence, outstanding checks, and known blockers.                |

## Product modules and contracts

The [planning and scope index](planning/README.md) collects Prisma sources, contracts, acceptance criteria, and remaining work by area. “Implemented” means code exists and a route is registered; execution evidence is recorded separately. Creating documentation does not complete an integration or certify a deployment.

| Area           | Scope and criteria                                                   | Documentation beside the code                                                                                                                    |
| -------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Authentication | [Registration, sessions, and Google](planning/auth/README.md)        | [auth](../src/modules/auth/docs/README.md)                                                                                                       |
| Courses        | [Catalog and editing](planning/courses/README.md)                    | [courses](../src/modules/courses/docs/README.md), [admin_courses](../src/modules/courses/features/admin_courses/docs/README.md)                  |
| Lessons        | [Content, publication, and resources](planning/lessons/README.md)    | [lessons](../src/modules/courses/features/lessons/docs/README.md), [admin_lessons](../src/modules/courses/features/admin_lessons/docs/README.md) |
| Progress       | [Enrollment and progress](planning/progress/README.md)               | [progress](../src/modules/progress/docs/README.md)                                                                                               |
| Community      | [Threads, reports, and moderation](planning/comments/README.md)      | [comments](../src/modules/comments/docs/README.md), [moderation](../src/modules/comments/features/moderation/docs/README.md)                     |
| Users          | [Profile, deletion, and directory](planning/users/README.md)         | [user](../src/modules/user/docs/README.md), [directory](../src/modules/user/features/directory/docs/README.md)                                   |
| Notifications  | [Subscriptions and topic requests](planning/notifications/README.md) | [notifications](../src/modules/notifications/docs/README.md)                                                                                     |

Also see [metric definitions](planning/metrics/README.md), the [access matrix](planning/permissions_audit/README.md), and [release history](shipped/README.md).

Routes, Zod schemas, constants, and service migrations take precedence if documents disagree. Unit READMEs retain detailed rationale; these guides connect the pieces without depending on harness documents absent from this repository.
