# Performance and memory

Academy runs Express in one process and shares one Prisma client with the `pg` adapter. It has no distributed caches or external job infrastructure. Its in-process storage cleanup worker polls a persisted queue every 30 seconds. This guide describes code-visible limits; there is no Academy benchmark establishing latency, RSS, or concurrent capacity.

## Actual resource budget

| Resource          | Implementation                                                    | Implication                                                                                   |
| ----------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| PostgreSQL        | One `PrismaPg` with `connectionString`                            | No application-configured `max`, query timeout, or admission queue.                           |
| Passwords         | Argon2id with library defaults                                    | No application-owned bounded queue or global cryptographic-work limit.                        |
| Required sessions | Session/user read per request                                     | Supports revocation and current roles; renewal writes at most every five minutes per session. |
| Rate limits       | Process memory                                                    | Restart clears windows; replicas maintain independent counters.                               |
| JSON/form         | 1 MiB limit for each parser                                       | Multipart limits are separate and usage-specific.                                             |
| Uploads           | Multer in memory, one file                                        | Buffers contribute to RSS; a resource can consume up to 20 MiB per request.                   |
| Video probe       | Fetch with a default 3000 ms timeout                              | No cache or global probe semaphore.                                                           |
| Storage cleanup   | Up to 10 jobs per cycle; leased jobs and bounded storage requests | Retries survive restarts; measure queue growth and database/storage latency under load.       |

Admin's two-connection budget, Argon2 queue, and measurements do not describe Academy. Check [Prisma configuration](../src/config/prisma_client.ts), [password hashing](../src/infrastructure/password/hash_password.ts), and [multipart](../src/middlewares/file_upload.ts) before changing limits.

## Queries and growth

The catalog aggregates totals in PostgreSQL and reads facets without article content. It still returns all matching courses and applies normalized search in Node. The administrative course list is also unpaginated. Both choices fit the current catalog and need review before thousands of courses.

My courses fetches lessons from several courses in one query and joins results by ID. Progress uses conflict-ignored insertion and conditional updates, avoiding an initial read to choose the maximum. Completion transactions remain short.

Moderation pages are limited to 50; directory and notification pages to 100. Directory search reads candidate users and normalizes name/email/organization in memory for counts, pages, and exports. This search is not indexed, and `per_page` does not bound all of its work.

User CSV counts first and rejects more than `ADMIN_EXPORT_MAX_ROWS` (50000 by default), then materializes complete rows and the buffer. Notification CSV and topic grouping read the entire selected set without that cap. Public comment threads are unpaginated. These are early measurement targets as the community grows.

## Measure before increasing capacity

Measure `node dist/server.js` separately from `tsx watch`, compilation, and Jest. Record Node version, non-sensitive configuration, fixture size, concurrency, p50/p95/p99, errors, RSS/heap, and active connections. Do not copy another product's figures or present one sequential local call as a load test.

Relevant scenarios include simultaneous sign-ins, catalog search, directory CSV, uploads near their limits, and many students advancing concurrently. Use a disposable database and owned files. Review `EXPLAIN` plans, indexes, and projections before expanding the pool or adding infrastructure.

Separate video/SMTP provider time from PostgreSQL time. Orderly shutdown must release HTTP, the cleanup worker, Prisma, and email without pending processes. Multiple instances require agreed shared storage and rate limiting before distributing traffic.

## Optimization acceptance

Preserve [contracts and metrics](planning/metrics/README.md): do not truncate pages after searching, alter facets, lose monotonic progress, or expose columns to avoid a mapper. Record baseline load, change, and subsequent measurements in release notes. Functional verification is described in [TESTING](TESTING.md).
