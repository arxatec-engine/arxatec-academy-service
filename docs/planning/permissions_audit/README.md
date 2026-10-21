# Identity, permissions, fields, and traceability

**Status:** sessions and the ADMIN role are implemented; granular capabilities and a general
command audit are not. [Auth](../auth/README.md) · [Index](../README.md).
Do not assume Academy implements Admin's persisted permission model.

## Access matrix

| Surface                                  | Anonymous                | STUDENT session                                         | ADMIN                              |
| ---------------------------------------- | ------------------------ | ------------------------------------------------------- | ---------------------------------- |
| Catalog, course details, visible threads | Yes                      | Yes                                                     | Yes                                |
| Published sample lesson                  | Yes                      | Yes                                                     | Yes                                |
| Other published lesson                   | 403 with metadata        | Yes                                                     | Yes                                |
| Enrollment and progress                  | 401                      | Own account                                             | Own account                        |
| Profile, summary, account deletion       | 401                      | Own identity                                            | Own identity                       |
| Public comment/reply                     | 401                      | Verified email required                                 | Verified email required            |
| Comment report                           | 401                      | Yes                                                     | Yes                                |
| Notification/topic subscription          | Email required           | Session email                                           | Session email                      |
| Exam status and submission               | 401                      | Own account; enrollment, syllabus, and exam gates apply | Same learner gates for own account |
| Public certificate verification/PDF      | Yes, with certificate ID | Yes                                                     | Yes                                |
| `/admin` routes                          | 401                      | 403 FORBIDDEN                                           | Yes                                |
| Local-driver `/files` URLs               | Yes, with URL            | Yes                                                     | Yes                                |

Optional authentication treats invalid tokens as anonymous. All administrative routers mount
authenticateTokenJwt and requireAdmin before their controllers. Replies through moderation
do not add the verified-email middleware used by public threads.

The role is loaded from PostgreSQL with the session. Changes take effect without waiting for
the JWT to expire. Registration cannot elevate roles, and there is no public ADMIN assignment
API. The development seed is not a production bootstrap procedure.

## Included and excluded fields

| Projection                   | Includes                                     | Excludes                                            |
| ---------------------------- | -------------------------------------------- | --------------------------------------------------- |
| Own user                     | Profile, email, role, provider, verification | Password hash, OAuth tokens, sessions, storage keys |
| Public author                | Name, avatar, affiliation, team badge        | Email, user_id, credentials                         |
| Locked lesson                | Identity, type, duration, public syllabus    | Video, article, transcript, resources               |
| Editor                       | Drafts and required content metadata         | Provider/storage credentials                        |
| Directory                    | Profiles and counts authorized for ADMIN     | Hashes, tokens, IP addresses, user agents           |
| Administrative notifications | Subscriber addresses and dates               | ip_hash and salt secrets                            |

Repositories select fields and mappers construct DTOs. Prisma access to a column does not
permit exposing it to the browser. Local downloads rely on a known public URL: hiding resources
in a DTO does not authenticate access to their bytes. Private S3 resources instead require
CloudFront signatures; see [STORAGE](../../STORAGE.md).

## Sessions, network, and logs

Send Bearer tokens in Authorization, never query parameters. Google state uses a cookie nonce
and a temporary exchange code. The HTTP logger omits query strings and response headers;
request IDs support correlation. Avoid logging request bodies, Authorization, or token-bearing
links when adding instrumentation.

The log email transport is only allowed in tests and includes message bodies for flow checks.
Treat these logs as sensitive. Auth stores session IP addresses and user agents; notifications
and topic requests store salted IP hashes. That salt does not anonymize every IP in the product.

CORS permits FRONTEND_URL and requests without Origin. Session and role checks are separate;
CORS does not protect against direct HTTP clients. Academy does not implement Admin's strict
cookie-based mutation-origin guard.

## Existing traceability

Moderation stores hidden_at/hidden_by_user_id, deleted_at/deleted_by_user_id, and report review
time/reviewer. These writes share transactions with the state changes. Logs include actor and
action. Directory exports log actor, request ID, count, and whether a search was supplied,
without storing the search text.

Course updates use an expected timestamp to prevent autosave overwrites. This is concurrency
control, not a version audit. Lessons and other commands do not carry that token. There is no
general change table, complete before/after history, commandKey, or transactional receipt system.

## Future commands and acceptance

If granular roles, role changes, suspension, or bulk email are added, define action permissions,
reasons, expected state, repeat behavior, and auditable fields. Obtain the actor from the session
and keep the change and relevant audit in one transaction. Never permit role elevation through
a registration form field.

The [integration matrix](../../../tests/integration/postgres/admin_access_control.test.ts)
checks routes without a session and with STUDENT. Acceptance also requires secret-free JSON,
verification on both public thread writes, persisted account cleanup, and hidden unpublished
content. Tests do not replace verification of the final [production](../../PRODUCTION_READINESS.md)
configuration and domain.
