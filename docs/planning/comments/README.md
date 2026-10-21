# Community: threads, reports, and moderation

**Status:** implemented. [Module](../../../src/modules/comments/docs/README.md) · [Moderation](../../../src/modules/comments/features/moderation/docs/README.md) · [Index](../README.md).

The same table serves public threads and editorial team replies.

## Model and public surface

comments identifies lesson, nullable author/parent, body, and VISIBLE/HIDDEN/DELETED state. comment_reports deduplicates comment/reporter and retains reason, review date, and reviewer. Replies point to roots; services reject replies to replies.

| Method/route under /api/v1         | Access                  | Result                        |
| ---------------------------------- | ----------------------- | ----------------------------- |
| GET /lessons/:lesson_id/comments   | Public                  | 200 visible comments/replies. |
| POST /lessons/:lesson_id/comments  | Bearer + verified email | 201 comment.                  |
| POST /comments/:comment_id/replies | Bearer + verified email | 201 comment.                  |
| POST /comments/:comment_id/report  | Bearer                  | 200 without data, repeatable. |

body is trimmed and limited to 1–2000 characters. It is plain text; tags do not make it safe HTML to render. reason is optional, max 280. Public-action IDs max 64. Comments/replies share five public writes/hour/user; reports do not use that specific limiter.

Lists return id, parent_id, body, created_at, and nullable author with full_name, avatar_url, affiliation, and is_team, excluding email, user_id, and session data. Affiliation uses independent status or organization; is_team reads the current role, so role changes update badges on existing comments.

Threads contain visible roots and visible replies. Hiding/deleting roots removes replies from public projections even when reply state remains VISIBLE. Public threads are unpaginated; unpublished lessons do not expose threads.

## Administration tools

/admin/comments requires active sessions and ADMIN. Moderation writes share 60/hour/actor.

| Action                           | Input                                       | Result                        |
| -------------------------------- | ------------------------------------------- | ----------------------------- |
| GET /admin/comments              | tab recent/reported/hidden, page, page_size | comments, counts, pagination. |
| GET /admin/comments/counts       | —                                           | pending/reported counts.      |
| POST /admin/comments/:id/replies | body                                        | 201 comment/counts.           |
| PATCH /admin/comments/:id/status | VISIBLE/HIDDEN                              | 200 id/status/counts.         |
| DELETE /admin/comments/:id       | —                                           | 200 id/DELETED/counts.        |

Pages start at 1; default size 20, max 50. Pagination contains page, page_size, total, has_next. DTOs add course/lesson references, report_count, is_reply, nullable is_answered, and is_public. Administrative responses are not public-author DTOs.

recent lists visible comments by current non-ADMIN authors; reported prioritizes unreviewed reports by first date; hidden sorts by hidden date. These are not three ways of counting every product comment.

## Counters, review, and traceability

reported counts VISIBLE comments with at least one unreviewed report, not report rows. pending unions those with VISIBLE non-ADMIN roots lacking a VISIBLE team reply. Do not add pending + reported because they overlap. See [metrics](../metrics/README.md).

Status changes review open reports in the same transaction. Transitioning to HIDDEN records actor/date; restoring visibility does not erase hiding history. Deletion is logical and reviews reports. Repeating DELETE returns DELETED; status PATCH on a deleted comment returns 409 COMMENT_ALREADY_DELETED.

Administrative replies require visible roots but do not add verified-email middleware for ADMIN, unlike public reply routes. Actor/action logs and traceability columns exist; there is no generic immutable Admin-equivalent audit log with receipts.

## Deletion, tests, and follow-up

The author FK uses SetNull for direct user deletion, but HTTP account deletion explicitly removes owned comments first. Parent cascades may remove replies. See [data model](../data_model/README.md); that endpoint does not promise anonymization.

[comments_flow](../../../tests/integration/postgres/comments_flow.test.ts) and [admin_moderation_flow](../../../tests/integration/postgres/admin_moderation_flow.test.ts) cover visibility, reports, verification, and badges. Suite cleanup affects seeded lesson threads, requiring disposable data.

Self-editing, nested replies, voting, thread subscriptions, and generic moderation events are out of scope. Grouped administrative routes need per-action separation; thread growth will need reply-compatible pagination.
