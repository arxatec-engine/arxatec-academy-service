# Notifications and topic requests

**Status:** implemented. [Module](../../../src/modules/notifications/docs/README.md) · [Schemas](../../../src/modules/notifications/shared/domain/notification.schema.ts) · [Index](../README.md).

The module records interest and supports administration; it does not deliver bulk campaigns.

## Public signups and effective email

| Route under /api/v1         | Input                             | Result                                      |
| --------------------------- | --------------------------------- | ------------------------------------------- |
| POST /notifications/signups | Guest email; optional course_slug | 200 without data, including repeats.        |
| POST /notifications/topics  | Guest email; search_term          | 200 without data; repeats increment counts. |

Valid Bearer uses session email and discards body email before validation. Invalid tokens mean anonymous access requiring email. Verified email is not required. Explicit email uses shared normalization/validation.

Omitting course_slug registers general-catalog interest; supplied slugs must identify published courses or return 404. Known draft slugs cannot receive course signups. search_term rejects ASCII controls, compacts spaces, requires 1–120 characters, and generates a case/accent-normalized grouping value.

Actions share 10/hour/IP and 5/hour/email limits; session email is also used for limiting. Persistence stores SHA-256 of salt + IP through NOTIFICATIONS_IP_HASH_SALT, not clear IP. This applies to these tables, not authentication sessions.

## Uniqueness, repetition, and data

notification_signups deduplicates email/course. General-catalog rows require the migration's partial unique index for null course_id. Inserts ignore conflicts; authenticated signups may link a prior anonymous row to the user in the same transaction. Repetition neither clears notified_at nor creates another subscription.

topic_requests has one row per email/normalized term. Repeating increments request_count and last_requested_at, not the number of people. Topic aggregates sum requests and count distinct emails separately without exposing addresses in that DTO.

## Administration

All /admin/notifications routes require sessions and ADMIN.

| Method/route                             | Input                                    | Result                    |
| ---------------------------------------- | ---------------------------------------- | ------------------------- |
| GET /admin/notifications/signups         | course_id, notified, page, per_page      | signups/pagination.       |
| GET /admin/notifications/signups/export  | course_id, notified                      | Complete filtered CSV.    |
| POST /admin/notifications/signups/notify | Nullable course_id, ISO signed_up_before | marked.                   |
| GET /admin/notifications/topics          | No declared filters                      | Topics grouped by demand. |
| DELETE /admin/notifications/subscribers  | Query email                              | 204 or 404 when absent.   |

List pages start at 1; per_page defaults 25, max 100; notified uses text true/false. Pagination contains page/per_page/total/has_next. Rows expose id, email, nullable course (id/title/slug), created_at, nullable notified_at, and has_account. The latter matches current users by email; it does not prove authenticated signup at creation.

Omitting course_id from list/export includes every course and general catalog; there is no general-only list selector. In the marking command, null course_id does select general catalog. signed_up_before is required and nonfuture; unnotified rows at/before the cutoff are marked. Repeating a cutoff yields zero for already-marked rows.

## CSV, marking, and privacy

Export contains email, course/catalog, signup/notification dates under the reporting offset, BOM, and formula protection. Limit: 20/hour/actor. ADMIN_EXPORT_MAX_ROWS does not apply; the repository reads the complete set into a buffer.

Marking writes only notified_at. It neither invokes SMTP nor proves delivery. UI should present administrative recording rather than delivered-email evidence. Future bulk delivery requires consent, retry, unsubscribe policy, and its own contract.

Deleting by email removes signups/topic requests transactionally, not the account. Account deletion removes user_id-linked rows, but an unlinked anonymous signup with the same email may remain. Cascades are not a universal email-address search.

## Acceptance and evolution

[notifications_flow](../../../tests/integration/postgres/notifications_flow.test.ts) covers deduplication, grouping, CSV, cutoff, and deletion. Also verify body email cannot impersonate sessions, general catalog retains one signup, and request_count/distinct_emails remain distinct metrics.

Topic listing groups complete rows in Node and is unpaginated. Measure growth before moving grouping into SQL or adding a bounded contract. Per-action slices, delivery, and general audit history remain future work.
