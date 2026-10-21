# Academy files

Covers, lesson resources, and avatars share a [port](../src/infrastructure/storage/storage.types.ts): `save`, `remove`, `publicUrl`, and `readUrl`. Both [local](../src/infrastructure/storage/local_storage.adapter.ts) and [S3 with signed CloudFront](../src/infrastructure/storage/s3_storage.adapter.ts) adapters are implemented. Selection occurs at process startup; services retain their multipart routes.

## Upload contracts

| Usage           | Route under `/api/v1`                      | Allowed format                    | Maximum size |
| --------------- | ------------------------------------------ | --------------------------------- | ------------ |
| Own avatar      | `PUT /me/avatar`                           | JPEG, PNG                         | 2 MiB        |
| Course cover    | `PUT /admin/courses/:id/cover`             | JPEG, PNG, WebP                   | 5 MiB        |
| Lesson resource | `POST /admin/lessons/:lesson_id/resources` | PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX | 20 MiB       |

Send multipart with one `file` field; resources also require `title`. Authentication/authorization precede Multer, which buffers bytes in memory. `validateUpload` checks size, allowed MIME, and binary signature. ZIP/OLE signatures identify Office containers, not their complete contents.

Covers must be landscape and at least 1200 × 750 pixels, otherwise `422 IMAGE_TOO_SMALL`. Invalid formats return `415 INVALID_FILE_TYPE`; oversized files return `413 FILE_TOO_LARGE`; invalid multipart returns `400 VALIDATION_ERROR`. See [file](../src/constants/files.ts) and [course policies](../src/constants/courses.ts).

## Keys and URLs

The server generates `public/avatars/`, `public/course_covers/`, and `private/lesson_resources/`. Legacy two-segment keys remain valid for reads/deletes and are signed when outside the `public/` root; this does not change the CDN behavior's access policy for that path. Adapters validate keys before writes/deletes; S3 also validates before URL construction/signing. Absolute paths, traversal, query strings, and URLs are not valid keys.

The database stores canonical URLs separately from internal keys: `avatar_url/avatar_key`, `cover_image_url/cover_image_key`, and `file_url/file_key`. `save().url` and `publicUrl(key)` are stable without temporary signatures. The seed uses `publicUrl` for sample metadata; it neither uploads bytes nor proves objects exist.

Services build responses with [resolveStoredFileUrl](../src/infrastructure/storage/file_url.ts) and repository-selected keys. With S3, `readUrl(key)` returns unsigned `/public/` URLs and signs `/private/` on read; local returns local URLs. Internal keys do not enter DTOs. External Google avatars and legacy null-key rows retain their original URLs; arbitrary URLs are not signed. Teacher photos entered as external URLs also bypass this storage.

Reads use the current base URL and persisted key. Changing domains does not require rewriting keyed-row URLs, but the new origin must contain the same keys/objects. Keyless rows need a controlled migration.

## Private S3 and CloudFront

With `STORAGE_DRIVER=s3`, uploads use `PutObject` and deletion uses `DeleteObject`. Bytes, `Content-Type`, and length are preserved; no public ACL is sent. AWS/signing failures return `503 STORAGE_UNAVAILABLE` without provider details. There is no fallback to public S3 or unsigned private CDN URLs. Retries and timeouts are bounded.

Minimal configuration, using examples rather than credentials:

```text
STORAGE_DRIVER=s3
AWS_REGION=us-east-1
S3_ACADEMY_PRODUCT_BUCKET=academy-files
CDN_ACADEMY_PRODUCT_BASE_URL=https://cdn.academy.example.com
CLOUDFRONT_ACADEMY_PRODUCT_KEY_PAIR_ID=PUBLIC_KEY_ID
CLOUDFRONT_ACADEMY_PRODUCT_PRIVATE_KEY_PATH=/run/secrets/cloudfront-private.pem
CLOUDFRONT_SIGNED_URL_TTL_SECONDS=300
```

Inject these through Infisical or the deployment environment. The path example requires a secret mounted by infrastructure; no repository-local PEM is supplied. Use an IAM role/default credential chain, or provide both `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`; `AWS_SESSION_TOKEN` supports temporary credentials. The backend identity needs `s3:PutObject` and `s3:DeleteObject` for its prefixes. Additional KMS permissions depend on bucket encryption.

Product variable names take priority with S3; generic aliases remain supported as listed in [ENV](ENV.md). Configure exactly one signing source: inline `CLOUDFRONT_ACADEMY_PRODUCT_PRIVATE_KEY` (escaped newlines supported), or `CLOUDFRONT_ACADEMY_PRODUCT_PRIVATE_KEY_PATH` pointing to a readable mounted private file. Never place PEM content in the frontend, repository, or public files directory. RSA must be 2048 bits. Invalid configuration fails startup without printing the key. Signing uses SHA256 and defaults to 300-second expiration; TTL accepts 1–86400 seconds. The ID is the CloudFront public key ID, not the group/distribution ID.

Enable **Restrict viewer access** and the trusted key group on `/private/*`. `/public/*` must allow unsigned reads. Keep S3 private with Block Public Access and CloudFront OAC/origin policy restricted to the distribution. OAC protects the origin; signing controls browser access. Configure HTTPS and, if frontend downloads use fetch, CORS for the appropriate origins and GET/HEAD/OPTIONS. AWS references: [signed URLs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html), [trusted keys](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-trusted-signers.html), and [S3 OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html).

## Authorization, expiration, and caching

Locked lessons neither query nor return resources. Authorized responses contain temporary resource URLs. Anyone holding a signed URL can use it until expiration; CDN downloads do not depend on Bearer authentication. New covers/avatars use `/public/` without signatures or expiration.

The API sends `Cache-Control: private, no-store`. Clients must query again to renew expired links and avoid retaining them as permanent references. Frontend in-memory caching must respect that lifetime; HTTP headers do not invalidate existing JavaScript state. CloudFront object caching is configured separately. Local `/files` remains public without Bearer and does not provide CloudFront's protection.

## Replacement, references, and deployment

Avatar/cover replacement saves the new object, updates the row, then attempts to delete the old object. Deleting a lesson removes its associated stored resources; deleting a resource removes its file. Hard-deleting a course also removes its cover and cascaded lesson resources. Archiving retains files because content still exists. Account deletion or avatar removal deletes the owned photo. External URLs are not deleted.

Migration `20261021030000_storage_deletions` records detached keys in `storage_deletions` using triggers on `lesson_resources`, `courses`, and `users`, in the same transaction, including cascades. Rollback creates no cleanup. Apply this migration before starting the backend; `prisma db push` does not install triggers. The queue does not depend on the process surviving long enough to execute code after commit.

[cleanup](../src/infrastructure/storage/cleanup.ts) attempts immediate deletion from services. Before deletion it checks resources, covers, and avatars for references: duplicated-course files remain until the last reference disappears. Uploads whose database write fails also attempt to queue/clean the new object without hiding the original error; a database outage during compensation is logged.

The server processes up to 10 jobs at startup and every 30 seconds. Failures remain queued with exponential delay from one minute to one hour, without discarding jobs after an attempt limit. Jobs are leased for two minutes; restarts recover expired leases. `SKIP LOCKED` and per-lease tokens support multiple processes without acknowledging another worker's job. Shutdown stops cleanup before disconnecting Prisma. Deleting an already-absent object is idempotent. The queue does not scan the bucket or purge objects orphaned before this migration.

Before switching local storage to S3, copy bytes under original keys and review keyless rows. Changing the driver alone is insufficient. Persist/back up local files together with the database. Vimeo/YouTube files are not uploaded through this port.

Tests use simulated S3 and ephemeral RSA keys to verify commands, bytes, MIME, errors, SHA256 signatures, exact resources, renewal, and configuration. This does not certify permissions or a real distribution. Verify final-environment upload/read/delete and unsigned/tampered/expired 403 behavior, including previously cached objects. See [storage planning](planning/storage/README.md) and [environment](ENV.md).

## Real development verification

On 2026-10-19, `arxatec-academy-product-development` and `https://cdn.dev.academy.arxatec.net` were verified for S3 upload/read/delete, MIME, and bytes. Unsigned `/public/` returned 200; signed `/private/` returned 200; unsigned, tampered, and actually expired private URLs returned 403. S3 denied anonymous reads on both roots. All three fixtures were deleted and absence confirmed with 404. Private keys and credentials stayed out of logs.

On 2026-10-20, a temporary lesson's PDF was uploaded to S3, existence was confirmed, the lesson was deleted through its service, and S3 returned 404. No job remained for that key, and the temporary course/fixtures were removed. Disposable PostgreSQL integration covered nine cleanup cases, including shared references, cascades, retries, lease recovery, and rollback.

Repeat infrastructure verification with `pnpm storage:check:development`. The script builds first, requires development environment/bucket, generates unique names, and removes only its fixtures even after failures. It does not touch the database or change AWS policies. Normal TTL remains 300 seconds; expiration uses an additional four-second URL, with SDK expiration rounded to seconds.

The CDN returned `Miss from cloudfront`, so a warm cache hit was not established. It also omitted Access-Control-Allow-Origin for the tested frontend origin; fetch/blob downloads would need CORS. Navigation links do not require that permission. Frontend in-memory URL renewal is verified separately.
