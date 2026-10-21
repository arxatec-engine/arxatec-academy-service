# Courses: catalog and editorial administration

**Status:** implemented. [Catalog](../../../src/modules/courses/features/catalog/docs/README.md) · [Editor](../../../src/modules/courses/features/admin_courses/docs/README.md) · [Index](../README.md).

## Data and selection

`courses` stores slug, title, descriptions, topic, level, cover, state, order, and dates. Catalog DTOs omit internal ID and long description; details include long description/content totals. Syllabuses expose `lesson.id` for learning operations. Public endpoints do not return draft content.

Topics: FIRST_STEPS, LEGAL_ENGINEERING, APPLIED_AI, ARXATEC_PRODUCT. Levels: INTRODUCTORY, INTERMEDIATE. Editorial states are DRAFT, PUBLISHED, ARCHIVED. Commands handle publication/archive rather than accepting arbitrary status through PATCH.

## Public catalog

`GET /api/v1/courses` accepts topic, level, and search. Enums accept repeated/comma-separated values; search trims, uses the first value, and is limited to 120 characters. Title/short-description search ignores case/accents. Results use catalog_order and are not paginated.

Returns `data: { courses, facets }`. Cards include slug, title, short description, topic, level, nullable cover, lesson_count, and total_duration_seconds. Topic facets include ALL and four topic keys; level facets include both keys, even at zero.

| Facet              | Applies              | Omits            |
| ------------------ | -------------------- | ---------------- |
| `facets.topic`     | Level                | Topic and search |
| `facets.level`     | Topic                | Level and search |
| `facets.topic.ALL` | Level; sum of topics | Topic and search |

Empty results return 200. `GET /courses/:slug` returns published `{ course, lessons }` and is_unlocked based on sample/session without enrollment. Totals use published lessons, combining video seconds and article minutes converted to seconds.

## Editor contracts and fields

All `/api/v1/admin/courses` routes require active sessions and ADMIN.

| Action            | Input                                      | Result                                        |
| ----------------- | ------------------------------------------ | --------------------------------------------- |
| List              | No implemented filters/pagination          | courses and global state counts.              |
| Create            | title, topic, level; optional descriptions | 201 course/lessons, draft, generated slug.    |
| Read              | id                                         | Editor course/lessons including drafts.       |
| Autosave          | expected_updated_at and allowed fields     | 200 with new date or 409 STALE_UPDATE.        |
| Publish/unpublish | id, command POST                           | Updated details.                              |
| Duplicate         | id                                         | 201, suffixed title, own slug, draft content. |
| Archive           | id                                         | ARCHIVED, retaining learning/files.           |
| Reorder           | Complete course_ids                        | Updated administrative list.                  |
| Cover             | Multipart file                             | Details with cover URL.                       |

Title max 140; slug/generated slug max 160; short description max 140. PATCH permits title, slug, both descriptions, topic, level, positive catalog_order, and teacher assignment. It requires ISO expected_updated_at; conditional writes compare that instant. Field updates and ordering movement share a transaction when sent together. Teacher input can create/update/assign a reusable profile or unassign with null.

Editor DTOs include slug_locked, can_publish, updated_at, and published_at. can_publish reflects only the published-lesson minimum, not description validity; commands validate descriptions separately. Storage keys are excluded from public DTOs.

## Transitions and invariants

Publication requires at least one published lesson and both descriptions nonempty. Archived courses cannot publish directly; unpublish returns DRAFT while retaining published_at. First publication locks the slug even after returning to draft. Repeated publication returns the existing state.

Complete ordering includes active DRAFT/PUBLISHED courses, excludes archived courses, and rejects stale sets with STALE_CATALOG_ORDER. Archiving adjusts the catalog without deleting progress. Duplication copies lessons/resources, not enrollments/comments, and may share stored files by key. Covers require landscape 1200 × 750; limits are in [storage](../../STORAGE.md). Replacement durably queues detached cover keys for cleanup; archived content retains its files.

## Queries and acceptance

Separate public/editor repositories live in [courses/shared/data](../../../src/modules/courses/shared/data). Catalog search normalizes in memory and facets have separate queries. Never paginate first and filter afterward; growth needs query/index review.

[admin_courses_flow](../../../tests/integration/postgres/admin_courses_flow.test.ts) covers flows, timestamp conflicts, and states; unit tests cover facets/mappers. Acceptance: no public drafts, stable slugs after publication, complete order without duplicates, and archive without learning loss. Grouped commands still need per-action separation; there are no generic idempotent receipts or Admin-equivalent content auditing.
