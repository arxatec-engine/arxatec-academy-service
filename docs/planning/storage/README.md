# Storage scope and evolution

**Status:** local storage and S3/CloudFront with `/public/` and `/private/` are implemented.
Other environments and existing-file migration still require validation. Development was
verified on 2026-10-19; see [STORAGE](../../STORAGE.md). [Index](../README.md).

## Ownership and flow

| Usage    | PostgreSQL metadata                                     | Writer              |
| -------- | ------------------------------------------------------- | ------------------- |
| Avatar   | users.avatar_url and avatar_key                         | Authenticated owner |
| Cover    | courses.cover_image_url and cover_image_key             | ADMIN               |
| Resource | lesson_resources URL, key, MIME, bytes, title, position | ADMIN               |

Authenticate and authorize before multipart handling, validate size/MIME/binary signature, save
the bytes, and persist the canonical URL and key. Resolve `readUrl` from the key when responding.
Public S3 keys use unsigned CDN URLs; private and legacy non-public keys use temporary signatures.
Never persist a signed read URL as the permanent reference. The API still receives upload bytes;
there are no presigned uploads, reservations, or confirmation-state endpoints.

## Consistency and migration

Duplicated courses can share `file_key`. Cleanup checks references across resources, covers,
and avatars before deleting bytes. PostgreSQL triggers enqueue replaced or removed keys in
`storage_deletions` within the owning transaction, including cascades. A worker retries failed
deletions, and services attempt immediate cleanup and compensation after failed persistence.
Database and storage remain separate systems: a database outage during compensation or existing
untracked orphans can still require reconciliation. Never infer arbitrary keys from legacy URLs
or delete objects based on a partial listing.

Before switching from local storage to S3, copy bytes while preserving keys and review rows with
null keys. The resolver uses the current domain for keyed records without rewriting their stored
URL. Seed URLs do not upload or prove the existence of any bytes.

## Operational acceptance

- Configure region/bucket, IAM role or credentials, HTTPS domain, and signing PEM/public-key ID.
- Keep S3 private with OAC and require signatures on the relevant private CDN behaviors.
- Test upload, download, MIME, replacement, deletion, retries, and shared references with fixtures.
- Verify rejection of missing/tampered/expired signatures, including cached objects.
- Check frontend CORS needs and link renewal on expiry; the API uses no-store.
- Measure concurrent upload memory: Multer keeps complete buffers.

Hermetic tests validate commands and cryptographic signatures, not deployed permissions.
The local driver exposes `/files` publicly and needs a persistent volume with backups coordinated
with the database. Development AWS evidence does not certify production configuration.
