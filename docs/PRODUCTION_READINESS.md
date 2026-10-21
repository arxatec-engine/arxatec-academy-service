# Production readiness — review dated 2026-10-20

This review compares documentation with routes, schemas, configuration, and migrations in the working tree. It records release-preparation evidence, not a production deployment or a transfer of Admin's verification results. Existing functional changes, including new files, are assessed from the available code; delivery still requires the target environment's operational checks.

## Evidence and scope

| Area           | Available evidence                                                                                                                       | Still requires verification                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Contracts      | Registered routes, schemas, and constants reviewed.                                                                                      | Deployed frontend/backend version compatibility.                                       |
| Code checks    | Backend lint, runtime/test type checks, boundaries, build, and 813 unit tests passed. Frontend lint, types, build, and 421 tests passed. | Repeat against the exact release revision and production configuration.                |
| PostgreSQL     | All 14 migrations applied to a disposable database; seeded integration passed 95 tests in 13 files; the database was removed.            | Target migration state, backups, and restoration procedure.                            |
| Authentication | JWT, persisted sessions, revocation, and Google flows implemented.                                                                       | Real Google flow with final credentials and domains.                                   |
| Files          | Local and signed S3/CloudFront, validation, shared-reference checks, and durable cleanup implemented; development S3 deletion verified.  | Production IAM, distribution, migrated objects, persistence, backup, and browser URLs. |
| Email          | SMTP implementation and test-only log transport; prior local connection/authentication check.                                            | Real mailbox delivery and final-domain links.                                          |
| Video          | Vimeo/YouTube and fake adapters implemented.                                                                                             | Playback and embedding for each published item.                                        |
| Configuration  | Local environment files and repository-local PEMs removed; Infisical YAML retained.                                                      | Authenticated access to `prod` secrets and target runtime validation.                  |

Commands and isolation are described in [TESTING](TESTING.md). S3/CloudFront implementation and checks are recorded in [2026 W43](shipped/2026_W43.md); the earlier documentation review remains in [2026 W42](shipped/2026_W42.md).

Compilation checks used explicit non-secret configuration. The frontend verification URL was `https://api.example.test/api/v1`, not a real production endpoint. The terminal has no authenticated Infisical session, so real `prod` secret injection and an external deployment were not verified.

## Configuration to review for the release

- Set `NODE_ENV=production`, a strong stable JWT secret, and final frontend/callback URLs.
- Supply a dedicated `NOTIFICATIONS_IP_HASH_SALT`; production rejects the development default.
- Set `EMAIL_TRANSPORT=smtp` with delivery credentials; log transport is rejected outside tests.
- Use `VIDEO_PROVIDER_DRIVER=live`; explicitly selecting fake is still accepted by the schema and returns fixture metadata.
- For local storage, provide a persistent directory and reachable URL. For S3, configure bucket/region, IAM, HTTPS CDN domain, signing key/ID, OAC, and signed private access. See [STORAGE](STORAGE.md).
- Supply the signing key inline through the secret manager or mount its supported file path outside the repository. Deleted local PEM files are not release assets.
- Match the proxy's topology to one trusted hop and configure upload limits.
- Apply migrations before backend startup, including `20261021030000_storage_deletions`; monitor/recover the cleanup queue. `db push` alone does not install triggers.
- Set the actual public `VITE_API_URL` at frontend build time and rebuild after changing it.

Check secrets for presence/validity without copying values into documentation or logs. The supplied Compose uses fixed development credentials and port 5444; it is not production configuration.

## Known follow-up and limits

| Topic                    | Current behavior                                                                                          | Completion criterion                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| S3                       | SDK save/delete and signed CloudFront reads implemented; real development fixtures verified.              | Configure production AWS, migrate objects, and verify access/deletion.                           |
| Private resources        | Signed CloudFront with S3; local `/files` remains public.                                                 | Verify unsigned/tampered/expired 403 responses, including cached objects, and frontend renewal.  |
| Database health          | `/ping` does not query PostgreSQL.                                                                        | Verify data availability separately; a future readiness endpoint needs implementation and tests. |
| Capacity                 | Pool and Argon2 have no dedicated bounded application budget.                                             | Measure concurrency, connections, memory, and saturation.                                        |
| PostgreSQL integrations  | Use `DATABASE_URL` and mutate seeded courses; the full suite passed in isolation.                         | Repeat only in disposable infrastructure for the release.                                        |
| Seed                     | Rewrites fixtures and includes demonstration videos/files; the automation sample exam uses all A answers. | Replace sample content with reviewed production material; do not seed production.                |
| Profile reads            | `GET /auth/me` exists; `GET /me/profile` is not registered.                                               | Consume the existing contract or implement/test the new route if needed.                         |
| Initial ADMIN            | Public registration always creates STUDENT; seed is production-blocked.                                   | Define an explicitly authorized operational provisioning procedure.                              |
| Failed OAuth             | Some callback failures return JSON `500` to the browser.                                                  | Agree and test frontend error-return behavior if changing that contract.                         |
| Administrative structure | Several actions share files.                                                                              | Separate actions while preserving contracts and checks.                                          |

No vulnerability scan or load benchmark was performed during this preparation. SMTP connection/authentication evidence does not prove real delivery. No new evidence certifies production migration, Google, SMTP, or CDN deployment. Close these items with actual release results rather than treating a guide as approval.

## Completing a release

Run code checks and isolated integrations, build from a clean directory with the target configuration, review target migrations/backups, start the artifact, and verify agreed surfaces using controlled fixtures. Record results and concrete follow-up in `shipped/YYYY_Wnn.md` without secrets or sensitive temporary URLs. Coordinate the frontend and retain database/file recovery plans.

## Development S3/CloudFront evidence

On 2026-10-19, product variables were used to verify S3 fixture upload/read/delete, unsigned `/public/` 200, and signed `/private/` 200. Unsigned private, tampered, and expired URLs returned 403; the S3 origin denied anonymous reads. Fixtures were removed with absence confirmed by 404. CDN responses did not establish a warm cache hit or CORS for the tested origin.

On 2026-10-20, a temporary lesson resource was uploaded to real development S3, the lesson was deleted through its service, and object absence was confirmed by 404 with no pending cleanup job for that key. Temporary course/data were removed. This verifies development behavior, not production configuration or migration of historical objects. See [STORAGE](STORAGE.md).
