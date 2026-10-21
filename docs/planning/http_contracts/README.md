# Cross-cutting HTTP contracts

**Status:** implemented endpoint conventions, with explicit pagination differences. [Complete API](../../API.md) · [Index](../README.md).

Sources: [routes](../../../src/routes/index.ts), [endpoints](../../../src/constants/endpoints.ts), and area schemas.

## Prefixes, identity, and transport

The API uses /api/v1. /auth manages sessions; /courses exposes catalog/content; /me operates on the account; /lessons and /comments accept operational IDs; /notifications supports public signups. All /admin routes require active JWT Bearer and persisted Academy ADMIN. Actors never come from client-chosen user_id.

Public course/lesson links use slugs; operations/editors use IDs. Most Prisma IDs are cuid; certificates use UUID. Schemas define validation individually rather than a universal exact-cuid constraint.

Standard JSON includes status, message, description, timestamp, path, and optional data/meta. DTOs use snake_case. Clients branch on meta.code, not description copy. Field errors carry i18n keys in meta.fields.

```json
{
  "status": 200,
  "message": "OK",
  "description": "Consulta completada",
  "timestamp": "2026-10-16T12:00:00.000Z",
  "path": "/api/v1/me/courses",
  "data": { "in_progress": [], "completed": [] }
}
```

This is structural; actual human-readable messages come from constants. Google redirects use 302, CSV uses UTF-8 bytes with BOM, and successful 204 account/lesson/resource/subscriber deletions omit envelopes. Avatar removal and sign-out return 200. /ping and /files are outside the API envelope.

## Pagination and empty results

There is no universal Admin-style pagination.

| Surface                            | Query                        | Response                                                                  |
| ---------------------------------- | ---------------------------- | ------------------------------------------------------------------------- |
| Directory                          | page=1, per_page=25; max 100 | data.users/data.stats; meta.pagination: page/per_page/total/total_pages.  |
| Moderation                         | page=1, page_size=20; max 50 | data.comments/data.counts/data.pagination: page/page_size/total/has_next. |
| Notifications                      | page=1, per_page=25; max 100 | data.signups/data.pagination: page/per_page/total/has_next.               |
| Catalog, admin courses, My courses | Unpaginated                  | Complete projection arrays.                                               |
| Public threads and grouped topics  | Unpaginated                  | Complete threads/topics.                                                  |

Valid empty sets return 200 with empty arrays. Directory total_pages is zero without rows; other paginated surfaces use has_next false. Never insert demonstration data or convert empty lists to 404; missing details do return 404.

## Filters and validation

Schemas usually use z.object and strip unknown keys; do not assume Admin's strict extra-field rejection. Exam submissions explicitly reject extra fields. Send declared fields with exact types: JSON booleans in bodies, text true/false in supported query filters.

Catalog/directory multi-enums accept commas or repeated parameters. Both search fields max 120, with action-specific normalization. ALL is a facet key, not a course topic/filter enum.

Directory dates use YYYY-MM-DD with a fixed reporting offset and inclusive final day. Autosave and notification cutoff accept ISO instants with distinct validators. Do not copy Admin's from/toExclusive or timezone parameters into unsupported routes.

## Concurrency and confirmations

Course PATCH requires expected_updated_at and returns STALE_UPDATE after changes. Catalog ordering requires all active IDs; lesson/resource ordering requires each complete set. There is no generic commandKey/idempotency receipt.

Content-discarding type changes return 409 with data.will_discard for confirmation; deleting drafts with student data returns counts and requires confirm_destroys_student_data. Frontends must retain those distinctions rather than a generic unexpected error.

Progress preserves the maximum under concurrent writes. Repetition differs by action: enrollment deduplicates; topic requests increment; publishing an already-published course returns its state; marking notifications sends nothing. HTTP 200 does not imply every action was a no-op.

## Errors and availability

400 covers invalid tokens/malformed JSON; 401 credentials/sessions; 403 permission, verification, or locked lessons; 404 absence; 409 conflicts; 413 size; 415 MIME/signature; 422 schema/content; 429 quota; 500 unexpected errors; 502 unavailable video probes; 503 unavailable storage/signing. See [API](../../API.md).

Locked lessons are 403 with public data. Video PATCH can save drafts with 200 and VIDEO_PROVIDER_UNAVAILABLE; not every meta.code is an HTTP failure. Repeated verification successes also carry a code. Committed file deletions can succeed while storage cleanup remains queued for retry.

There is no Admin-equivalent partial-metric degradation contract: failed Prisma queries do not silently become zero/empty lists. JSON exposes no stacks or SQL errors. Failed CSV operations use the standard error envelope.

## Compatibility criteria

Compare frontend payloads with real schemas, preserving names and pagination placement. Verify authorization before operations/files, absent secret fields, empty states, conflicts, and bodyless 204 responses. Shape changes require API and consumer updates, not just plan text. Checks/limits are in [TESTING](../../TESTING.md).
