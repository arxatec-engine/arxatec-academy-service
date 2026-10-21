# API — Arxatec Academy

Base: `/api/v1`. Domain fields use `snake_case`.

[Documentation index](README.md) · [Cross-cutting contracts](planning/http_contracts/README.md) · [Access matrix](planning/permissions_audit/README.md).

This list covers registered server endpoints. Public course/lesson identifiers are slugs; administration uses IDs. `/admin` requires Bearer and `ADMIN`; `/me` requires Bearer. Errors use `meta.code`. Public syllabuses expose `lesson.id` alongside slugs for progress/comments, while locked lesson content remains absent.

Executable sources are [routes](../src/routes/index.ts), [endpoints](../src/constants/endpoints.ts), schemas, and constants under `src/`. Sections 1–8 retain authentication details and historical verification; sections 9–20 cover catalog, learning, accounts, and administration. The 2026-08-21 check does not certify subsequently added routes or a current deployment.

## Routes outside authentication

| Method        | Route                                        | Access                 | Main result                                 |
| ------------- | -------------------------------------------- | ---------------------- | ------------------------------------------- |
| GET           | `/courses`                                   | Public                 | Catalog, search, and facets.                |
| GET           | `/courses/:slug`                             | Public                 | Details and published syllabus.             |
| GET           | `/courses/:course_slug/lessons/:lesson_slug` | Public/optional Bearer | Sample or unlocked lesson; `LESSON_LOCKED`. |
| POST          | `/courses/:slug/enroll`                      | Bearer                 | Enrollment.                                 |
| GET           | `/courses/:slug/exam`                        | Bearer                 | Exam, access, and latest result.            |
| POST          | `/courses/:slug/exam/attempts`               | Bearer                 | Grading and certificate on passing.         |
| PUT           | `/lessons/:lesson_id/progress`               | Bearer                 | Saved playback position.                    |
| POST / DELETE | `/lessons/:lesson_id/complete`               | Bearer                 | Complete/unmark.                            |
| GET           | `/me/courses`                                | Bearer                 | In-progress/completed courses.              |
| GET           | `/certificates/:id`                          | Public                 | Verifiable certificate and QR.              |
| GET           | `/certificates/:id/pdf`                      | Public                 | Downloadable PDF certificate.               |
| GET           | `/lessons/:lesson_id/comments`               | Public                 | Visible thread.                             |
| POST          | `/lessons/:lesson_id/comments`               | Verified Bearer        | Comment.                                    |
| POST          | `/comments/:comment_id/replies`              | Verified Bearer        | Reply.                                      |
| POST          | `/comments/:comment_id/report`               | Bearer                 | Report.                                     |
| PATCH         | `/me/profile`                                | Bearer                 | Edit profile.                               |
| PATCH         | `/me/password`                               | Bearer                 | Change password.                            |
| PUT / DELETE  | `/me/avatar`                                 | Bearer                 | Upload/remove avatar (`200`).               |
| GET           | `/me/summary`                                | Bearer                 | Learning summary.                           |
| DELETE        | `/me`                                        | Bearer                 | Account and data deletion.                  |
| POST          | `/notifications/signups`                     | Public/optional Bearer | Idempotent notification signup.             |
| POST          | `/notifications/topics`                      | Public/optional Bearer | Topic request.                              |

Most routes return `200`; comment creation returns `201`. Bodies and fields are validated by feature schemas. Both notification POSTs return `200` without `data`, including when a signup row already exists.

## Administration routes

| Method               | Route                                       | Result / distinctive error                                                                                            |
| -------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| GET / POST           | `/admin/courses`                            | List/counts or create draft (`201`).                                                                                  |
| GET / PATCH          | `/admin/courses/:id`                        | Editor/syllabus or autosave with `expected_updated_at`; `STALE_UPDATE`, `SLUG_LOCKED`, `SLUG_TAKEN`.                  |
| POST                 | `/admin/courses/:id/publish`                | Publish; `COURSE_HAS_NO_LESSONS`.                                                                                     |
| POST                 | `/admin/courses/:id/unpublish`              | Return to draft.                                                                                                      |
| POST                 | `/admin/courses/:id/duplicate`              | Copy course, lessons, and resources (`201`).                                                                          |
| POST                 | `/admin/courses/:id/archive`                | Remove from catalog without deleting progress.                                                                        |
| PUT                  | `/admin/courses/order`                      | Complete ID list; `STALE_CATALOG_ORDER`.                                                                              |
| PUT                  | `/admin/courses/:id/cover`                  | Multipart `file` cover; `IMAGE_TOO_SMALL`.                                                                            |
| GET / PUT            | `/admin/courses/:id/exam`                   | Read/save versioned exam configuration.                                                                               |
| GET                  | `/admin/teachers`                           | Reusable teacher profiles.                                                                                            |
| GET / POST           | `/admin/courses/:course_id/lessons`         | Internal syllabus or add draft (`201`).                                                                               |
| PUT                  | `/admin/courses/:course_id/lessons/order`   | Complete IDs; `LESSON_ORDER_MISMATCH`.                                                                                |
| GET / PATCH / DELETE | `/admin/lessons/:id`                        | Details, editing, or deletion requiring confirmation when student data exists.                                        |
| POST / DELETE        | `/admin/lessons/:id/publish`                | Publish/unpublish.                                                                                                    |
| POST                 | `/admin/lessons/:lesson_id/resources`       | Multipart `file` and `title` attachment (`201`).                                                                      |
| PATCH / DELETE       | `/admin/lessons/:lesson_id/resources/:id`   | Rename/remove resource.                                                                                               |
| PUT                  | `/admin/lessons/:lesson_id/resources/order` | Resource ordering.                                                                                                    |
| POST                 | `/admin/videos/probe`                       | `{provider, external_id}`; Vimeo returns duration, YouTube returns null and requires manual duration in lesson PATCH. |
| GET                  | `/admin/comments`                           | Paginated `recent`, `reported`, `hidden` tabs.                                                                        |
| GET                  | `/admin/comments/counts`                    | `pending` and `reported`.                                                                                             |
| POST                 | `/admin/comments/:id/replies`               | Team reply (`201`).                                                                                                   |
| PATCH                | `/admin/comments/:id/status`                | `VISIBLE` / `HIDDEN`; reviews reports.                                                                                |
| DELETE               | `/admin/comments/:id`                       | Logical deletion.                                                                                                     |
| GET                  | `/admin/users`                              | Filtered directory, global stats, and pagination.                                                                     |
| GET                  | `/admin/users/export`                       | Filtered unpaginated CSV; `EXPORT_TOO_LARGE`.                                                                         |
| GET                  | `/admin/notifications/signups`              | Notification signups.                                                                                                 |
| GET                  | `/admin/notifications/signups/export`       | Signup CSV.                                                                                                           |
| POST                 | `/admin/notifications/signups/notify`       | Mark rows up to a cutoff.                                                                                             |
| GET                  | `/admin/notifications/topics`               | Grouped topics.                                                                                                       |
| DELETE               | `/admin/notifications/subscribers?email=…`  | Forget address (`204`).                                                                                               |

CSV downloads return UTF-8 with BOM on success and the standard JSON envelope on error. All administrative routes use `authenticateTokenJwt` and `requireAdmin`.

## 1. Envelope

Business JSON responses, including errors, use [buildHttpResponse](../src/utils/build_http_response.ts). CSV, redirects, files, `/ping`, and `204` use their specific transports:

```jsonc
{
  "status": 200,
  "message": "OK",
  "description": "Sesión iniciada correctamente",
  "timestamp": "2026-08-21T00:30:45.366Z",
  "path": "/api/v1/auth/login",
  "data": {}, // only when the endpoint returns a payload
  "meta": {}, // only when codes, fields, or retry information apply
}
```

`data` and `meta` are **omitted** when inapplicable, not set to null. `description` is human-readable copy, currently supplied by backend message constants; clients must not compare it. Use stable `meta.code` for branching.

## 2. User model

```jsonc
{
  "id": "cmt27py150000hva4ebf034qw",
  "full_name": "Curl Manual",
  "email": "maria@estudioqp.pe",
  "role": "STUDENT",
  "organization": null,
  "is_independent": true,
  "city": "LIMA",
  "city_other": null,
  "avatar_url": null,
  "email_verified_at": null,
  "auth_provider": "PASSWORD",
  "created_at": "2026-08-21T00:29:58.025Z",
}
```

`id` is a **cuid** without a resource prefix ([users.prisma](../prisma/schema/users.prisma)). Dates use ISO 8601 with `Z`. **`password_hash` is never exposed**: explicit repository selects and the field-by-field `toApiUser` allowlist provide independent barriers ([user_mapper.ts](../src/modules/auth/shared/domain/user_mapper.ts)).

## 3. Session

```jsonc
{ "token": "eyJhbGciOi…", "expires_at": "2026-09-20T00:29:58.028Z", "user": {/* section 2 */} }
```

JWTs contain `sub`, `jti`, `role`, `iat`, `exp`, and `iss`, signed with HS256 ([sign_session_token.ts](../src/infrastructure/jwt/sign_session_token.ts)). **The database is authoritative**: required authentication checks the `auth_sessions` row identified by `jti` ([authenticate_token_jwt.ts](../src/middlewares/authenticate_token_jwt.ts)) and renews `expires_at` at most once every five minutes per session (`AuthPolicy.session_sliding_renewal_seconds`). Optional authentication validates without renewing.

| `remember_me`    | Allowed inactivity |
| ---------------- | ------------------ |
| `true` (default) | 30 days            |
| `false`          | 12 hours           |

Response `expires_at` is the inactivity expiration. Token **`exp` is a different date**: the absolute 180-day cap from session creation (`AuthTokenTtlSeconds.session_absolute_max`). Rows can slide while signed JWTs cannot. Using the initial sliding date for token expiration previously evicted active users after 30 days. At the absolute cap, sign-in is required again regardless of activity.

## 4. The 11 authentication endpoints

| #   | Method | Route                   | Auth   | Limit                                    | Success                           |
| --- | ------ | ----------------------- | ------ | ---------------------------------------- | --------------------------------- |
| 1   | POST   | `/auth/register`        | Public | 5/hour per IP                            | `201` + session                   |
| 2   | POST   | `/auth/login`           | Public | 30/15 min per IP; 10/15 min per IP+email | `200` + session                   |
| 3   | POST   | `/auth/logout`          | Bearer | —                                        | `200` without `data`              |
| 4   | GET    | `/auth/me`              | Bearer | —                                        | `200` + `{ user }`                |
| 5   | POST   | `/auth/password/forgot` | Public | 5/hour per IP; 3/hour per email          | `200` without `data`              |
| 6   | POST   | `/auth/password/reset`  | Public | 20/hour per IP                           | `200` without `data`              |
| 7   | POST   | `/auth/email/verify`    | Public | 20/hour per IP                           | `200` without `data`              |
| 8   | POST   | `/auth/email/resend`    | Bearer | 5/hour per user + 45 seconds             | `200` + `{ retry_after_seconds }` |
| 9   | GET    | `/auth/google`          | Public | —                                        | `302` to Google                   |
| 10  | GET    | `/auth/google/callback` | Public | —                                        | `302` to frontend                 |
| 11  | POST   | `/auth/google/exchange` | Public | 20/hour per IP                           | `200` + session                   |

### 1 · `POST /auth/register` → `201`

```jsonc
{
  "full_name": "María Quispe Rojas",
  "email": "maria@estudioqp.pe",
  "password": "aLongExamplePassword", // 8–128 characters
}
```

Only name, email, and password are required. `organization`, `is_independent`, `city`, and `city_other` remain optional. Omitted values create an account without organization/written city, `is_independent: false`, and `city: "OTHER"`. Explicit `city: "OTHER"` still requires `city_other`.

Returns `data: { token, expires_at, user, verification_email_sent }` with an open session and `remember_me: true` ([register.service.ts](../src/modules/auth/features/registration/register/presentation/register.service.ts)). Email is lowercased/trimmed; body `role` and `email_verified_at` are **discarded** because they are absent from the schema.

Verification email is sent within the request, and **delivery failure does not break registration**. Account/session still return, `verification_email_sent` becomes false, and `SystemMessages.email_failed` is logged. This is D-002: without a queue, an SMTP outage must not cost an account. Errors: `409 EMAIL_ALREADY_REGISTERED`, `422 VALIDATION_ERROR`, `429 RATE_LIMITED`.

### 2 · `POST /auth/login` → `200`

```jsonc
{ "email": "maria@estudioqp.pe", "password": "…", "remember_me": true }
```

**Unknown email and wrong password return the same response** (`401 INVALID_CREDENTIALS`, identical description/meta). The unknown-account path still performs Argon2 verification against a dummy hash to reduce timing disclosure ([login.service.ts](../src/modules/auth/features/email_login/login/presentation/login.service.ts)). A Google-created account without a password is the explicit exception: `409 ACCOUNT_USES_GOOGLE`.

Password validation uses `min(1)`, not `min(8)`; applying registration policy would turn the attempt into a length-revealing `422`.

### 3 · `POST /auth/logout` → `200`

No body. The closed session is the token's `jti`, never a body-supplied `session_id`. Repeating the POST with the same token returns `200` and `description: "La sesión ya estaba cerrada"`, because only this route uses `authenticateRevocableSession` ([logout.routes.ts](../src/modules/auth/features/session/logout/presentation/logout.routes.ts)). Invalid signatures, unknown `jti`, and expired sessions are still rejected.

### 4 · `GET /auth/me` → `200`

Returns `data: { user }`, supporting the frontend guard. Errors: `401 UNAUTHENTICATED` for absent/malformed Bearer, `401 SESSION_EXPIRED` for revoked/expired sessions, and `404 NOT_FOUND`.

### 5 · `POST /auth/password/forgot` → `200`

```jsonc
{ "email": "maria@estudioqp.pe", "redirect_to": "/curso/fundamentos" } // optional redirect_to
```

Returns `200` whether the email exists, with identical copy and a 400 ms floor (`AuthPolicy.password_forgot_min_response_ms`). The single-use link expires after one hour; issuing another invalidates the previous link.

### 6 · `POST /auth/password/reset` → `200`

```jsonc
{ "token": "…", "password": "aNewLongExamplePassword" }
```

One transaction consumes the token, changes the hash, verifies email if needed, and **revokes every user session** ([reset.repository.ts](../src/modules/auth/features/password_reset/reset/data/reset.repository.ts)). Invalid, expired, or used token: `400 TOKEN_INVALID`.

### 7 · `POST /auth/email/verify` → `200`

Accepts `{ "token": "…" }`. A repeated click returns `200` with `meta.code: "EMAIL_ALREADY_VERIFIED"`. No `data` is returned: the token travels in email, and returning a profile would disclose the user to anyone holding the link.

### 8 · `POST /auth/email/resend` → `200`

No body (`{}` or none accepted). Returns `data: { retry_after_seconds: 45 }` for the UI countdown. Too early: `429 RESEND_COOLDOWN` with remaining seconds in `meta.retry_after_seconds`, not the whole window. Already-verified email returns `200`, `EMAIL_ALREADY_VERIFIED`, and `data.retry_after_seconds: 0` without sending email.

### 9–11 · Google

```text
GET  /auth/google?redirect_to=/curso/x
     → 302 to accounts.google.com; redirect_to is HMAC-SHA256 signed inside state
     → Set-Cookie: arxatec_oauth_state=<nonce>; HttpOnly; SameSite=Lax (binds state to browser)
GET  /auth/google/callback?code=…&state=…   (with that cookie, otherwise 400 TOKEN_INVALID)
     → 302 to ${FRONTEND_URL}/oauth/callback?code=<single-use-code>&redirect_to=…
POST /auth/google/exchange { "code": "…" }
     → 200 { token, expires_at, user }
```

The intermediate opaque code is hashed, lasts **60 seconds**, and is single-use. A JWT in the URL would enter browser history, Referer headers, and proxy logs.

Additional behavior:

1. If Google does not mark the email verified and an account already uses it, linking is rejected with `400 TOKEN_INVALID` ([callback.service.ts](../src/modules/auth/features/google_login/callback/presentation/callback.service.ts)). This prevents unverified provider assertions from accessing another account.
2. Google accounts use `city: "OTHER"`, `city_other: null`: city is required, but Google supplies none. Email registration uses the same defaults when city is omitted. Profile updates permit only the name.

## 5. Error codes (`meta.code`)

Clients branch on stable codes. This table covers authentication; section 18 adds content, file, and administrative errors.

| HTTP | `meta.code`                | Condition                                                                                                     | Source                                                                                                                                                                                                                                                                                                        |
| ---- | -------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400  | `TOKEN_INVALID`            | Invalid/expired/used verification/reset/exchange token; invalid/expired Google state or missing nonce cookie. | [verify](../src/modules/auth/features/email_verification/verify/presentation/verify.service.ts), [reset](../src/modules/auth/features/password_reset/reset/presentation/reset.service.ts), [exchange](../src/modules/auth/features/google_login/exchange/presentation/exchange.service.ts), `oauth_state.ts`. |
| 401  | `INVALID_CREDENTIALS`      | Wrong email or password.                                                                                      | [login](../src/modules/auth/features/email_login/login/presentation/login.service.ts).                                                                                                                                                                                                                        |
| 401  | `UNAUTHENTICATED`          | Missing/malformed Bearer or invalid signature.                                                                | [authentication](../src/middlewares/authenticate_token_jwt.ts), [JWT verification](../src/infrastructure/jwt/verify_session_token.ts).                                                                                                                                                                        |
| 401  | `SESSION_EXPIRED`          | Revoked, expired, or absent session.                                                                          | [authentication](../src/middlewares/authenticate_token_jwt.ts).                                                                                                                                                                                                                                               |
| 403  | `EMAIL_NOT_VERIFIED`       | Posting a public comment/reply requires verified email.                                                       | `assertVerifiedEmail` in [authenticated_user](../src/utils/authenticated_user.ts), via [middleware](../src/middlewares/require_verified_email.ts).                                                                                                                                                            |
| 404  | `NOT_FOUND`                | Missing user or route.                                                                                        | [get_me](../src/modules/auth/features/session/get_me/presentation/get_me.service.ts), [error handler](../src/middlewares/error_handler.ts).                                                                                                                                                                   |
| 409  | `EMAIL_ALREADY_REGISTERED` | Registration with an existing email.                                                                          | [registration](../src/modules/auth/features/registration/register/presentation/register.service.ts).                                                                                                                                                                                                          |
| 409  | `ACCOUNT_USES_GOOGLE`      | Password login for a Google account without a hash.                                                           | [login](../src/modules/auth/features/email_login/login/presentation/login.service.ts).                                                                                                                                                                                                                        |
| 422  | `VALIDATION_ERROR`         | Zod rejects input.                                                                                            | [error handler](../src/middlewares/error_handler.ts).                                                                                                                                                                                                                                                         |
| 429  | `RESEND_COOLDOWN`          | Resending before 45 seconds.                                                                                  | [resend](../src/modules/auth/features/email_verification/resend/presentation/resend.service.ts).                                                                                                                                                                                                              |
| 429  | `RATE_LIMITED`             | Request limit exceeded.                                                                                       | [rate limit](../src/middlewares/rate_limit.ts).                                                                                                                                                                                                                                                               |
| 500  | `INTERNAL_ERROR`           | Unhandled failure.                                                                                            | [error handler](../src/middlewares/error_handler.ts).                                                                                                                                                                                                                                                         |
| 200  | `EMAIL_ALREADY_VERIFIED`   | Already verified for verify/resend.                                                                           | [verify controller](../src/modules/auth/features/email_verification/verify/presentation/verify.controller.ts), [resend controller](../src/modules/auth/features/email_verification/resend/presentation/resend.controller.ts).                                                                                 |

`EMAIL_NOT_VERIFIED` is not emitted by auth endpoints. Public thread-writing routes (`POST /lessons/:id/comments`, `POST /comments/:id/replies`) emit it through `requireVerifiedEmail`. These are the product operations requiring verified email (D-006); catalog, lessons, enrollment, and progress do not.

A `422` adds field details:

```jsonc
"meta": {
  "code": "VALIDATION_ERROR",
  "fields": {
    "full_name": "auth.errors.full_name_required",
    "email": "auth.errors.email_invalid",
    "password": "auth.errors.password_too_short"
  }
}
```

**`fields` contains i18n keys, never visible copy.** The catalog is `src/constants/validation_keys.ts`; the global handler replaces non-key-shaped messages with `errors.validation.invalid` ([error handler](../src/middlewares/error_handler.ts)).

## 6. Request limits

Authentication limits live in `AuthRateLimits` in [auth.ts](../src/constants/auth.ts). Exceeding them returns `429 RATE_LIMITED` and `Retry-After`.

Login and password-forgot each use two buckets: one per IP and one account-oriented bucket. The account bucket limits targeted brute force; the IP bucket limits password spraying across emails, which one composite IP+email bucket would not stop.

Section 19 lists progress, comment, administrative, and notification limits. The two public thread-writing routes share one per-user bucket, not five comments plus five independent replies.

Buckets live in process memory, so multiple instances multiply effective limits. `Retry-After` reports the complete window (for example 3600 seconds), not the remaining time, because `express-rate-limit` v8 no longer exposes the previous `req.rateLimit` value used by this implementation.

## 7. `redirect_to`

Must be a relative path beginning with `/`. Schemes, `//`, hosts, backslashes, and control characters are rejected ([safe_redirect.ts](../src/utils/safe_redirect.ts)); accepting `https://evil.example` would create an open redirect. The same pure function validates password-forgot and Google startup destinations.

## 8. Historical auth verification — 2026-08-21

The earlier document recorded calls to all 11 endpoints with `curl` against `node dist/server.js`, Compose PostgreSQL, and `EMAIL_TRANSPORT=log` on 2026-08-21. Results:

| Call                                       | HTTP                           |
| ------------------------------------------ | ------------------------------ |
| Register                                   | `201`                          |
| Register duplicate email                   | `409`                          |
| Register invalid body                      | `422`                          |
| Current user                               | `200`                          |
| Current user without Bearer                | `401`                          |
| Resend during cooldown                     | `429`                          |
| Resend after 45 seconds                    | `200`                          |
| Verify email                               | `200`                          |
| Verify again                               | `200 EMAIL_ALREADY_VERIFIED`   |
| Sign out                                   | `200`                          |
| Sign out again                             | `200`                          |
| Sign in                                    | `200`                          |
| Sign in with wrong password                | `401`                          |
| Forgot password                            | `200`                          |
| Forgot unknown email                       | `200`, identical response      |
| Reset password                             | `200`                          |
| Reuse reset token                          | `400`                          |
| Current user after reset revoked session   | `401 SESSION_EXPIRED`          |
| Sign in with new password                  | `200`                          |
| Start Google                               | `302` to `accounts.google.com` |
| Google callback with valid state/fake code | `500`, see below               |
| Google callback with tampered state        | `400 TOKEN_INVALID`            |
| Google callback without code/state         | `422`                          |
| Exchange unknown Google code               | `400 TOKEN_INVALID`            |
| Exchange without code                      | `422`                          |

**Recorded limitation:** development Google credentials returned `invalid_client`; provider failure surfaced as JSON `500 INTERNAL_ERROR` in the browser tab because the browser navigates to this URL. Redirecting instead to `${FRONTEND_URL}/oauth/callback?error=…` requires an agreed/tested frontend error parameter. Documentation does not change that behavior or establish a new provider check. Current configuration permits log email only in tests; this table is historical evidence.

## 9. Catalog, course details, and lessons

`GET /courses` accepts repeated or comma-separated topic/level filters and search up to 120 characters. It is unpaginated, contains only PUBLISHED courses, and uses editorial order. Search normalizes case/accents and filters title/short description. Example `data`:

```jsonc
{
  "courses": [
    {
      "slug": "fundamentos-de-legal-tech",
      "title": "Legal Tech Fundamentals",
      "short_description": "Course introduction",
      "topic": "FIRST_STEPS",
      "level": "INTRODUCTORY",
      "cover_image_url": null,
      "lesson_count": 2,
      "total_duration_seconds": 660,
    },
  ],
  "facets": {
    "topic": {
      "ALL": 1,
      "FIRST_STEPS": 1,
      "LEGAL_ENGINEERING": 0,
      "APPLIED_AI": 0,
      "ARXATEC_PRODUCT": 0,
    },
    "level": { "INTRODUCTORY": 1, "INTERMEDIATE": 0 },
  },
}
```

This is illustrative, not a production inventory. Topic facets apply level; level facets apply topic; both omit search and their own filter. ALL sums topics. Empty results return `200`, empty courses, and complete facets.

`GET /courses/:slug` supports optional sessions and returns `{ course, lessons }`. Course adds long description, `video_count`, `article_count`, and `published_at`. Lessons contain id, slug, title, description, type, position, nullable duration/reading minutes, `is_free_sample`, and `is_unlocked`. Counters include only published lessons; total duration includes article minutes × 60.

`GET /courses/:course_slug/lessons/:lesson_slug` returns:

| HTTP              | Condition                            | `data`                                         |
| ----------------- | ------------------------------------ | ---------------------------------------------- |
| 200               | Free sample or active session        | Open lesson, course, and navigation.           |
| 403 LESSON_LOCKED | Published but inaccessible           | Lesson metadata, course, and syllabus lessons. |
| 404 NOT_FOUND     | Missing/unpublished course or lesson | No content.                                    |

Open lessons include nullable video `{provider, external_id}`, `article_body`, `transcript`, `resources`, `updated_at`, and metadata. Resources contain title/file_url/mime_type/size_bytes. Locked responses omit the four content fields. Navigation contains nullable previous/next slug/title and skips drafts. Reading requires neither verified email nor enrollment. Invalid optional Bearer is treated as anonymous.

Topics: FIRST_STEPS, LEGAL_ENGINEERING, APPLIED_AI, ARXATEC_PRODUCT. Levels: INTRODUCTORY, INTERMEDIATE. Types: VIDEO, ARTICLE. See [courses](planning/courses/README.md) and [lessons](planning/lessons/README.md).

## 10. Enrollment and progress

These routes require Bearer but not verified email; user identity comes from the session.

| Route                                 | Body                                                   | `data`                                                    |
| ------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| `POST /courses/:slug/enroll`          | None required                                          | `{ enrollment }`                                          |
| `PUT /lessons/:lesson_id/progress`    | `{ "last_position_seconds": 120, "completed": false }` | `{ progress }`                                            |
| `POST /lessons/:lesson_id/complete`   | None required                                          | `{ mark: { lesson_id, completed_at, enrollment } }`       |
| `DELETE /lessons/:lesson_id/complete` | None required                                          | `{ mark: { lesson_id, completed_at: null, enrollment } }` |
| `GET /me/courses`                     | —                                                      | `{ in_progress, completed }`                              |

All return `200`. Position is an integer 0–86400; optional `completed` defaults false. Progress contains lesson_id, last_position_seconds, completed_at, and updated_at. Position only increases despite late events. `completed=true` also performs completion marking.

Enrollment includes course slug/title, started_at, nullable completed_at, completed_lessons, lesson_count, and nullable next_lesson slug/title. Repeated enrollment does not duplicate. Completion ensures enrollment without rewriting an existing closure date. Unmarking clears lesson/enrollment completed_at while preserving position; enrollment can be null.

My courses separates `in_progress` (course, counters, next lesson) and `completed` (course, total, date), for published courses only. New lessons may return a course to in_progress without erasing its earlier date. A course with no published lessons is not completed. See [progress](planning/progress/README.md).

### Certificates and exams

Enrollment and both My courses lists include nullable UUID `certificate_id`. Completing lessons unlocks the exam; only passing issues a certificate. Exams have exactly 15 questions, four options, and one correct option per question; the initial threshold is 12 correct (80%), configurable in administration. New marks, name/title changes, and new lessons do not alter issued certificates. Account deletion removes certificates and their links stop resolving.

`GET /certificates/:id` is public and returns `data.certificate`: id, recipient_name, course_title, completed_at, issued_at, verification_url, and qr_code_data_url (PNG data URL). It exposes neither email nor user/course IDs. Verification URLs use `FRONTEND_URL` and `/certificados/:id`.

`GET /certificates/:id/pdf` is public and returns a PDF attachment with the same QR/link, without JSON envelope. Both routes disable HTTP caching. Unknown UUID: 404; invalid format: 422. PDF accepts `?language=es|en|pt` (default es) and reproduces the web card's logo, typography, badge, and composition. Unsupported language returns 422. Height adapts while preserving one page and omitting UI share controls. See [certificates](../src/modules/progress/features/certificates/docs/README.md).

`GET /admin/courses/:id/exam` and PUT require ADMIN. PUT accepts `expected_version` (0 on creation), `enabled`, `passing_score`, and 15 questions with `text`, four distinct `options`, and `correct_option` 0–3. It returns `data.exam` with the new version. Student GET returns `data.exam` and reveals questions only in `ready` after all published lessons are complete, never `correct_option`. Other states are `locked`, `unavailable`, and `passed` for an existing certificate.

Attempt POST accepts `{ version, answers: [0, ...] }` with 15 answers and rejects extra fields. It uses session identity and server grading. Returns `data.result` with score, passed, passing_score, question_count, and nullable certificate_id. Limit: five submissions per minute per user. Changed version: `409 EXAM_CHANGED`; disabled/unconfigured: `409 EXAM_UNAVAILABLE`; pending lessons: `403 EXAM_LOCKED`. Responses disable HTTP caching. A passed attempt and certificate are saved together; repeated submissions preserve the certificate. Pre-exam certificates remain available. See [exams](../src/modules/progress/features/exams/docs/README.md).

## 11. Threads and reports

Comment GET returns `{ comments: [...] }` with visible roots/replies. Each has id, parent_id, body, created_at, and nullable author. Authors contain full_name, avatar_url, affiliation, and is_team, never email. There is no public pagination.

Root/reply POST accepts `{ "body": "Question text" }`, trimmed, 1–2000 characters, returning `201 { comment }`. Content is plain text and requires verified email. Replying to a reply returns 422; hidden/nonvisible roots return 404.

Reporting accepts `{ "reason": "Optional reason" }` up to 280 characters or `{}`. It requires a session and returns `200` without data. A unique index prevents repeated reports by one user/comment. Hiding/deleting a root removes its replies from public projections too. See [community](planning/comments/README.md).

## 12. Profile, password, avatar, and deletion

Current reads use `GET /auth/me` returning `{ user }`; `GET /me/profile` is not registered. `PATCH /me/profile` accepts only `{ "full_name": "Full name" }`, trimmed, 2–120 characters. Organization, independent status, and city are not part of this update contract and are ignored if sent. Session identity determines the user. Email, role, and verification cannot be changed. Success: `200 { user }`.

`PATCH /me/password` accepts nonempty current_password and new_password of 8–128 characters, different from the current password. Returns `200 { revoked_sessions }`, revoking other sessions while retaining the current one. Google without a hash returns `409 ACCOUNT_USES_GOOGLE`; wrong current password returns `401 INVALID_CREDENTIALS`.

`PUT /me/avatar` accepts multipart JPEG/PNG `file` up to 2 MiB; DELETE removes it. Both return `200 { user }`; removal leaves avatar_url null. `GET /me/summary` returns `{ member_since, completed_courses }`, counting persisted closure dates rather than currently up-to-date courses.

`DELETE /me` accepts `{ "password": "current password" }` for password accounts; accounts without hashes may omit it. Returns 204. Owned data, including comments, is deleted transactionally; replies may cascade. This is not reversible deactivation. Owned avatars enter durable cleanup. See [users](planning/users/README.md).

## 13. Course administration

Teachers are stored in `teachers` and reused across courses. ADMIN-only `GET /admin/teachers` returns `{ teachers: [{ id, full_name, biography, photo_url }] }`. Course PATCH accepts `teacher: { id?, full_name, biography, photo_url }`: no id creates a teacher; id edits/assigns an existing one; null unassigns. Saving preserves transactional `expected_updated_at` checks. Public course GET adds nullable `course.teacher` with the three profile fields, without ID.

Listing returns unpaginated `{ courses, counts }`, archived last. Counts include total/published/draft/archived. Rows include id, title, slug, topic, level, status, lesson_count, published_lesson_count, catalog_order, and updated_at.

Creation requires title (1–140), topic, and level; descriptions default empty. It generates a slug and DRAFT state. Creation/duplication return `201 { course, lessons }`. Details use the same shape with editor data, slug_locked, can_publish, and dates. can_publish reflects the published-lesson minimum; the command validates descriptions separately.

```json
{
  "expected_updated_at": "2026-10-16T12:00:00.000Z",
  "title": "Legal Tech Fundamentals",
  "short_description": "Course introduction",
  "long_description": "Full course description"
}
```

PATCH requires the latest read timestamp and permits title, slug, descriptions, topic, level, and positive catalog_order. Slugs allow lowercase letters/digits and hyphens, up to 160 characters; short description up to 140. Stale date: `409 STALE_UPDATE`.

Publication requires a published lesson and nonempty descriptions. First publication seals published_at and locks the slug even after unpublishing. Archived courses cannot publish directly; unpublishing returns DRAFT. Archiving preserves progress/files; duplication does not copy students.

`PUT /admin/courses/order` accepts all active course IDs, excluding archived ones, in `{ "course_ids": ["id-a", "id-b"] }`; conflicts return `409 STALE_CATALOG_ORDER`. Covers use multipart JPEG/PNG/WebP `file`, up to 5 MiB, landscape and at least 1200 × 750. Success returns `200` details. Replacement queues the prior cover for unused-file cleanup. See [editorial rules](planning/courses/README.md).

## 14. Lesson, resource, and video administration

Creating under a course accepts `{ "title": "Introduction", "type": "ARTICLE" }` and returns `201 { lesson, course }`. Listing returns course/editor lessons. Detail GET includes content, resources with IDs/positions, article metrics, and updated_at.

PATCH permits title, slug, description, type, is_free_sample, video_provider, video_external_id, duration_seconds, article_body, transcript, and confirm_type_change. Title/slug max 160; external ID max 64. No expected_updated_at is required. Marking a free sample removes that mark from other course lessons.

Type changes with existing content return 409 with data.from/to/will_discard and require confirmation. The server clears prior-type fields, sanitizes articles, and recalculates metrics. Published edits becoming incomplete return DRAFT. Sanitized article content is limited to 150000 characters.

Publication requires title, slug, description, and type-appropriate content. Missing fields return `422 LESSON_INCOMPLETE` with data.missing_fields; empty articles return ARTICLE_BODY_EMPTY. POST `/publish` publishes; DELETE `/publish` unpublishes; both return `200` details.

Lesson DELETE requires DRAFT. Student data produces `409 LESSON_HAS_STUDENT_DATA` with progress_count/comment_count and requires `{ "confirm_destroys_student_data": true }`. Published lessons return `409 LESSON_PUBLISHED`. Success is physical deletion with 204.

Syllabus order requires complete lesson_ids; resource order requires complete resource_ids. Mismatches return `422 LESSON_ORDER_MISMATCH`. Resource POST accepts multipart file/title and returns `201 { resource }`; PATCH renames using title; DELETE removes with 204. Resource fields are id/title/file_url/mime_type/size_bytes/position.

Lesson/resource deletions transactionally queue detached storage keys. Immediate cleanup removes unused objects; failures remain persisted for retry. Shared references prevent deleting files still used by another resource/course. API deletion success does not require S3 to be available at that moment.

```json
{ "provider": "YOUTUBE", "external_id": "dQw4w9WgXcQ" }
```

This probe example does not guarantee the video's availability. Returns `{ duration_seconds, title, thumbnail_url }`. Vimeo requires a numeric ID and supplies duration; YouTube requires 11 characters and returns null duration. Saving YouTube requires positive manual duration up to 2147483647. A new ID without provider chooses YouTube.

Direct probing can return `502 VIDEO_PROVIDER_UNAVAILABLE`. PATCH may save a draft after a temporary failure and return 200 with that meta.code. Missing/nonembeddable videos return 422. See [content details](planning/lessons/README.md).

## 15. Moderation

GET `/admin/comments` accepts tab recent/reported/hidden, page >=1, and page_size default 20/max 50. Returns comments, counts, and pagination with page/page_size/total/has_next. Rows add status, body, is_reply, parent_id, nullable is_answered, report_count, is_public, restricted author, and course/lesson references.

GET `/counts` returns `{ counts: { pending, reported } }`. reported counts visible comments with open reports; pending unions those with non-ADMIN roots without a visible team reply. Do not add both counts. recent excludes ADMIN authors; hidden sorts by hiding time.

POST `/:id/replies` accepts body and returns `201` with comment/counts. PATCH `/:id/status` accepts VISIBLE/HIDDEN, reviews reports, and returns `200` with comment/counts. DELETE performs logical deletion and returns 200 with DELETED state. Repeated DELETE is accepted; status changes on deleted comments return `409 COMMENT_ALREADY_DELETED`. See [moderation](planning/comments/README.md).

## 16. User directory and CSV

GET `/admin/users` accepts search (max 120), multiple city, registered_from/registered_to in YYYY-MM-DD, text true/false is_independent/email_verified/has_completed, multiple completed_topic, sort created_at/full_name, page, and per_page. Defaults: 1/25, max 100. The final day is inclusive under the reporting offset; created_at sorts descending, full_name ascending, with ID tie-breaking.

```jsonc
{
  "data": {
    "users": [],
    "stats": {
      "total_registered": 0,
      "registered_this_week": 0,
      "week_start": "2026-10-12T05:00:00.000Z",
    },
  },
  "meta": { "pagination": { "page": 1, "per_page": 25, "total": 0, "total_pages": 0 } },
}
```

This is an illustrative envelope fragment. Stats are global, not filtered. Users expose permitted profile fields and completed_courses based on closure dates, never hashes, sessions, or IPs.

GET `/admin/users/export` uses the same filters without pagination. CSV includes BOM, download headers, no-store, and formula neutralization. `ADMIN_EXPORT_MAX_ROWS` bounds exports; excess returns `422 EXPORT_TOO_LARGE` with meta.row_count/max_rows. See [users](planning/users/README.md).

## 17. Notifications and topic demand

POST `/notifications/signups` accepts guest email and optional course_slug. Omitted slug means the general catalog; supplied slug requires a published course. POST `/notifications/topics` accepts guest email and search_term of 1–120 characters, compacted spaces, without ASCII control characters.

A valid session supplies its own email and discards the body email. Both return 200 without data. Signups deduplicate; repeated topic requests increment request_count. IPs in these tables are salted hashes.

Administrative signup lists accept course_id, notified true/false, page, and per_page (default 1/25, max 100), returning signups/pagination with page/per_page/total/has_next. Rows include id/email, nullable course, created_at, notified_at, and has_account matched against current users.

Exports filter by course_id/notified and return all selected CSV rows without the user-export cap. Omitting course_id includes both general and course subscriptions, not only general ones.

```json
{ "course_id": null, "signed_up_before": "2026-10-16T12:00:00.000Z" }
```

POST `/admin/notifications/signups/notify` accepts this body: null selects the general catalog and the timestamp cannot be future. It marks unnotified rows created at/before the cutoff and returns `{ marked }`; it sends no email.

GET `/admin/notifications/topics` returns topics with search_term, search_term_normalized, request_count, distinct_emails, and last_requested_at. Subscriber DELETE accepts query email, removes both tables' rows for it, and returns 204 or 404 if absent. See [notifications](planning/notifications/README.md).

## 18. Errors beyond authentication

| HTTP | meta.code                                  | Condition                                               |
| ---- | ------------------------------------------ | ------------------------------------------------------- |
| 403  | FORBIDDEN                                  | Session lacks ADMIN.                                    |
| 403  | LESSON_LOCKED                              | Published lesson is locked or unavailable for progress. |
| 409  | SLUG_TAKEN / LESSON_SLUG_TAKEN             | Slug already used in its scope.                         |
| 409  | SLUG_LOCKED                                | Course was previously published.                        |
| 409  | STALE_UPDATE / STALE_CATALOG_ORDER         | Stale timestamp or ordering set.                        |
| 409  | COURSE_HAS_NO_LESSONS                      | Publishing without published lessons.                   |
| 409  | INVALID_STATE_TRANSITION                   | Direct publication of an archived course.               |
| 409  | LESSON_TYPE_CHANGE_NOT_CONFIRMED           | Unconfirmed content-discarding type change.             |
| 409  | LESSON_PUBLISHED / LESSON_HAS_STUDENT_DATA | Deletion blocked or awaiting confirmation.              |
| 409  | COMMENT_ALREADY_DELETED                    | Changing status of a deleted comment.                   |
| 413  | FILE_TOO_LARGE                             | File exceeds its limit.                                 |
| 413  | VALIDATION_ERROR                           | JSON/urlencoded exceeds 1 MiB.                          |
| 415  | INVALID_FILE_TYPE                          | Unsupported MIME or mismatched signature.               |
| 422  | IMAGE_TOO_SMALL                            | Invalid cover dimensions/orientation.                   |
| 422  | LESSON_ORDER_MISMATCH                      | Invalid lesson/resource ID set.                         |
| 422  | LESSON_INCOMPLETE / ARTICLE_BODY_EMPTY     | Insufficient publication content.                       |
| 422  | VIDEO_NOT_FOUND / VIDEO_NOT_EMBEDDABLE     | Provider rejects the video.                             |
| 422  | EXPORT_TOO_LARGE                           | Too many user CSV rows.                                 |
| 502  | VIDEO_PROVIDER_UNAVAILABLE                 | Probe network/timeout/response failure.                 |
| 503  | STORAGE_UNAVAILABLE                        | Storage operation/signing unavailable.                  |

Malformed JSON/multipart can return `400 VALIDATION_ERROR`. Zod returns 422 with i18n field keys. Unexpected failures return `500 INTERNAL_ERROR`, with details only in logs. Many schemas strip unknown keys rather than rejecting every extra field. Codes live in [error_codes](../src/constants/error_codes.ts); status depends on the action. A 200 can carry EMAIL_ALREADY_VERIFIED or VIDEO_PROVIDER_UNAVAILABLE as a signal.

## 19. Limits outside authentication

| Operation                      | Limit                              | Key                |
| ------------------------------ | ---------------------------------- | ------------------ |
| Save position                  | 1/second                           | User               |
| Public comment + reply         | Shared 5/hour                      | User               |
| Submit exam                    | 5/minute                           | User               |
| Course autosave                | 60/minute                          | ADMIN              |
| Video probe                    | 20/hour                            | ADMIN              |
| Moderation reply/status/delete | Shared 60/hour                     | ADMIN              |
| User CSV                       | 5/hour                             | ADMIN              |
| Notification signup + topic    | Shared 10/hour IP and 5/hour email | IP/effective email |
| Notification CSV               | 20/hour                            | ADMIN              |

Limiters are process-local and return `429 RATE_LIMITED` with the whole window in Retry-After. Verification resending uses RESEND_COOLDOWN with remaining time. Restarts and replicas affect in-memory accounting. Other routes do not inherit quotas absent from their router.

## 20. Health and files outside `/api/v1`

GET `/ping` returns HTTP liveness text without querying PostgreSQL. There is no SQL readiness route. With local storage, GET `/files/<key>` serves public bytes without JWT/JSON envelope; with S3 this static route is omitted. Directory indexes and dotfiles are denied. Signatures, MIME, and size are checked on upload, not when requesting a known URL.

With S3, new covers/avatars use unsigned `/public/`; resources use `/private/` and receive signed CloudFront URLs on response (SHA256, default 300-second TTL). The database stores canonical URLs and keys; DTOs retain `*_url` fields without internal keys. Legacy keyless rows/external URLs retain their original address. Locked lessons do not sign resource URLs. Clients renew expired links by querying the API and must not treat them as permanent. API responses use `Cache-Control: private, no-store`.

S3/signing failures return `503 STORAGE_UNAVAILABLE` without provider details or unsigned fallback; invalid configuration prevents startup. Committed deletion cleanup is the exception: failures stay queued for retry rather than undoing the database deletion.

[STORAGE](STORAGE.md) details access/persistence; [TESTING](TESTING.md) defines verification environments. This contract describes available code, not a new live verification of every external integration or production deployment.
