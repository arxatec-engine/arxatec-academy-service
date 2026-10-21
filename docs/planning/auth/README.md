# Authentication, sessions, and Google

**Status:** implemented. [HTTP contract](../../API.md) · [Module](../../../src/modules/auth/docs/README.md) · [Index](../README.md).

Actors belong to Academy and authenticate with email/password or Google.

## Sources and public data

`users` stores profile, provider, role, and verification date; `auth_sessions` stores session state; `auth_tokens` stores hashed secrets; `oauth_accounts` stores external links. Public users expose ID, name, email, role, organization, independent status, city, avatar, verification, provider, and creation time, excluding hashes, avatar keys, OAuth tokens, and private session metadata.

Registration requires only `full_name`, `email`, and `password`. Profile fields are optional; omitted city produces OTHER/null, while explicit OTHER requires `city_other`. Clients cannot choose roles: registration creates STUDENT. Email is trimmed/lowercased; passwords of 8–128 characters are preserved exactly. Sign-in requires only nonempty passwords, without reapplying the registration minimum.

## Actions and results

| Action under `/api/v1/auth` | Result                                                        | Rule                                                        |
| --------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| `POST /register`            | 201 with token, expires_at, user, and verification_email_sent | Creates account/session and attempts verification delivery. |
| `POST /login`               | 200 with session                                              | remember_me defaults true.                                  |
| `GET /me`                   | 200 with user                                                 | JWT and active session required.                            |
| `POST /logout`              | 200 without data                                              | Closes token jti; repeatable.                               |
| `POST /password/forgot`     | Generic 200                                                   | Same response for known/unknown email.                      |
| `POST /password/reset`      | 200 without data                                              | Consumes token and revokes all sessions.                    |
| `POST /email/verify`        | 200 without data                                              | Repeated click returns EMAIL_ALREADY_VERIFIED.              |
| `POST /email/resend`        | 200 with retry delay                                          | Session required; 45-second cooldown.                       |
| `GET /google`               | 302 to Google                                                 | Signed state and browser-bound nonce.                       |
| `GET /google/callback`      | 302 to frontend                                               | Opaque exchange code, not JWT.                              |
| `POST /google/exchange`     | 200 with session                                              | One-use, 60-second code.                                    |

## Session and authorization

JWTs have a 180-day absolute cap. Rows apply 30-day inactivity with remember_me or 12 hours without; required authentication renews at most every five minutes. Optional authentication neither renews nor returns 401 for invalid Bearer, continuing anonymously. Database outages remain errors rather than fabricated anonymous sessions.

Roles/verification come from related users, not stale claims. Sign-out accepts revoked sessions but not false tokens or expired/missing sessions. There is no separate refresh token. OAuth cookies protect the handshake only; they do not replace Bearer.

## Tokens, email, and concurrency

Verification tokens last 24 hours; recovery tokens one hour. Repositories consume with `consumed_at: null` conditions. Reset groups consumption, hashing, verification, and session revocation transactionally. A new link invalidates the earlier link in that flow. Never return secrets or a user profile solely to a verification-link holder.

Registration retains accounts after SMTP failure. Forgot starts delivery without waiting and applies a 400 ms floor. Unknown sign-in uses a dummy Argon2 hash; Google accounts without passwords retain `409 ACCOUNT_USES_GOOGLE`. Indistinguishability is not promised for every account type.

`redirect_to` accepts only safe relative paths, rejecting schemes, hosts, double slashes, backslashes, and controls. Callbacks check state/cookie before profiles; unverified Google email cannot link an existing account.

## Tests, limits, and follow-up

Unit tests live in each action. [auth_flow](../../../tests/integration/postgres/auth_flow.test.ts) covers persisted flows and revocation. Google tests substitute collaborators and do not prove provider consent. Detailed limits are in [API](../../API.md).

Token repositories remain spread across actions; consolidation into shared is technical debt. Callback provider failures may return JSON 500 to the browser; a redirected error return needs a shared frontend contract. Initial production ADMIN provisioning requires an authorized procedure: seed blocks production, and public registration never elevates roles.
