# Endpoint reuse and product boundaries

**Status:** inventory of implemented routes. [API](../../API.md) · [Index](../README.md).

Shared architecture with Admin does not share identities, permissions, or DTOs.

## Actual identities and prefixes

Academy accepts JWT Bearer and queries Academy auth_sessions. Admin has its own identity/cookie; Lawyer has its own product rules. Matching names/emails in another database do not automatically link actors. Do not send Admin cookies or Lawyer JWTs to Academy routes.

Academy's editorial panel uses this service's /api/v1/admin. The prefix denotes Academy ADMIN authorization, not delegation to arxatec-admin-service.

## Existing contracts by screen

| Need                 | Existing endpoint/contract                     | Avoids                                                    |
| -------------------- | ---------------------------------------------- | --------------------------------------------------------- |
| Browse courses       | GET /courses and /courses/:slug                | Copying catalog into a directory/other backend.           |
| Open content         | GET /courses/:course_slug/lessons/:lesson_slug | Reading the admin editor for student content.             |
| Operational identity | Syllabus lesson.id                             | Guessing IDs from slugs or querying Prisma from frontend. |
| Current account      | GET /auth/me; PATCH /me/profile                | Using administrative lists for sign-in.                   |
| Personal learning    | /me/courses and /me/summary                    | Presenting directory globals as individual state.         |
| Edit content         | /admin/courses and /admin/lessons              | Giving public endpoints write privileges.                 |
| Team replies         | /admin/comments/:id/replies                    | Elevating roles from a comment field.                     |
| User export          | /admin/users/export                            | Downloading pages to build a different browser CSV.       |
| Manage notifications | /admin/notifications                           | Mixing account directories and anonymous subscriptions.   |

Public/editorial course queries use different projections over the same tables. Retain both surfaces to protect drafts/locked content rather than making clients hide it visually.

## Reuse inside the backend

Auth publishes identity/sessions through shared; courses publishes course/lesson references; progress publishes closure counts and cleanup for user; comments publishes owned-data cleanup. Explicit transaction clients preserve each operation's needed atomicity.

Do not import another action/module's private data layer to save a file. Read DTOs are not an internal persistence API; a minimal state/ID reference serves progress better than returning whole articles/editors.

## Nonequivalent contracts

Directory closure totals differ from My courses completed: one uses retained dates, the other requires current syllabus completion. User pagination is in meta; notification/moderation pagination is in data, with different filter names.

Repeating POST /notifications/topics increments demand; signup deduplicates. Moderation DELETE is logical/200; lesson DELETE is physical/204. Do not build universal adapters that assume identical semantics for every resource.

## Future integrations

If Admin needs Academy metrics, design an internal identity and bounded contract. There is no M2M bridge or secondary reader here. Similarity to Admin does not imply an external plan catalog or release feed. Verify ownership, permissions, and coordinated changes before sharing data.

Acceptance means reusing existing contracts without expanding permissions, preserving mappers/empty states, and avoiding incompatible definitions of one count. Update consumer, docs, and tests together for contract changes.
