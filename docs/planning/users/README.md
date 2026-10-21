# Users: profile, account, and administrative directory

**Status:** implemented. [Profile/account](../../../src/modules/user/docs/README.md) · [Directory](../../../src/modules/user/features/directory/docs/README.md) · [CSV](../../../src/modules/user/features/directory_export/docs/README.md) · [Index](../README.md).

## Student account

/me routes require active sessions and operate only on the authenticated user. Controllers do not accept another identity through query/body. Current reads use GET /auth/me; GET /me/profile is not registered. Profile DTOs reuse the public auth user, excluding credentials/storage keys.

| Route under /api/v1 | Input                          | Result                              |
| ------------------- | ------------------------------ | ----------------------------------- |
| PATCH /me/profile   | full_name only                 | 200 user.                           |
| PATCH /me/password  | current_password, new_password | 200 revoked_sessions.               |
| PUT /me/avatar      | Multipart file                 | 200 user.                           |
| DELETE /me/avatar   | —                              | 200 user with null avatar.          |
| GET /me/summary     | —                              | 200 member_since/completed_courses. |
| DELETE /me          | Password when a hash exists    | 204 without body.                   |

Profile PATCH is not an arbitrary merge: it accepts full_name, trimmed, 2–120 characters. Organization, independent status, and city can exist on accounts but are not editable through this current endpoint; unknown body fields are ignored. Email, role, and verification cannot be edited here.

Password changes require current password and a different new password of 8–128 characters. A transaction writes the hash and revokes other sessions, retaining the current one. Google accounts without hashes return 409 ACCOUNT_USES_GOOGLE; wrong current password returns 401 INVALID_CREDENTIALS. Notification-email failure does not undo the change.

Avatars accept signature-checked JPEG/PNG up to 2 MiB. Upload replaces the reference and cleans the prior file; removal is repeatable while the user exists. Failed cleanup remains durably queued without undoing committed updates. A failed database write after upload also attempts cleanup of the new object.

## Account deletion and retention

With a persisted hash, DELETE verifies password; accounts without hashes do not require one. One transaction deletes progress, owned comments/reports, auth artifacts, then the user. Cascades remove linked notifications/topics and certificates. Deleting owned roots can cascade other authors' replies. The avatar is queued transactionally and deletion is attempted afterward.

The author's SetNull FK does not imply HTTP retention: explicit comment cleanup precedes user deletion. Direct database deletion has different comment semantics. Account deletion is neither reversible nor simple profile deactivation.

## Administrative directory and filters

GET /admin/users requires ADMIN and returns data.users/data.stats with meta.pagination. Rows include ID, name, email, organization, independent status, city, creation/verification dates, and completed_courses, excluding hashes, sessions, tokens, IPs, and avatar keys.

| Parameter                                       | Contract                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------ |
| search                                          | Trimmed, max 120; case/accent-insensitive name/email/organization.       |
| city                                            | Multiple enums, repeated or comma-separated.                             |
| registered_from / registered_to                 | YYYY-MM-DD; inclusive reporting days.                                    |
| is_independent / email_verified / has_completed | Literal text true/false.                                                 |
| completed_topic                                 | Multiple topics; enrollment closure date in any selected topic.          |
| sort                                            | created_at descending by default or full_name ascending; ID tie-breaker. |
| page / per_page                                 | Start at 1; default 25, max 100.                                         |

Completion filters use enrollments.completed_at IS NOT NULL, not current syllabus recalculation. has_completed and completed_topic combine with AND. Stats include global total_registered, registered_this_week, and week_start, independent of filters. Weeks start Monday under REPORTING_UTC_OFFSET_MINUTES, default -300.

## CSV and queries

GET /admin/users/export shares filters, omits pagination, and retains directory order. It exports name, email, affiliation, city, registration date, and completed courses using reporting dates. Returns UTF-8 CSV with BOM, Content-Disposition, and Cache-Control no-store. Formula-prefix cells are neutralized by the CSV utility.

Limit: five exports/hour/ADMIN. Exceeding ADMIN_EXPORT_MAX_ROWS returns 422 EXPORT_TOO_LARGE with row_count/max_rows, not a silently truncated file. CSV is buffered, not streamed. Search also materializes user candidates; [performance](../../PERFORMANCE.md) explains cost.

## Acceptance and boundaries

[account_flow](../../../tests/integration/postgres/account_flow.test.ts) verifies personal commands; [admin_users_flow](../../../tests/integration/postgres/admin_users_flow.test.ts) verifies directory/export. Check identity isolation, excluded secrets, row limits, reporting dates, and persisted revocation. Personal summaries count retained closures and can differ from currently up-to-date courses; they do not measure presence or study time.

The directory does not support editing other users, role changes, suspension, administrative session revocation, or other databases. Such commands need permissions, traceability, and contracts; frontend buttons do not authorize them.
