import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

import { GetObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { env } from '../dist/config/env.js';
import { FileUsages, MimeTypes } from '../dist/constants/files.js';
import { createS3Storage } from '../dist/infrastructure/storage/s3_storage.adapter.js';
import { storage } from '../dist/infrastructure/storage/storage.js';
import { buildStorageKey } from '../dist/infrastructure/storage/storage_key.js';

assert.equal(env.NODE_ENV, 'development', 'This check is restricted to development');
assert.equal(env.STORAGE_DRIVER, 's3', 'S3 must be configured');
assert.ok(env.AWS_S3_BUCKET?.endsWith('-development'), 'A development bucket is required');

const client = new S3Client({
  region: env.AWS_REGION,
  ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? {
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          ...(env.AWS_SESSION_TOKEN ? { sessionToken: env.AWS_SESSION_TOKEN } : {}),
        },
      }
    : {}),
  maxAttempts: 2,
  requestHandler: { connectionTimeout: 3000, requestTimeout: 15000 },
});
const shortLived = createS3Storage({
  bucket: env.AWS_S3_BUCKET,
  region: env.AWS_REGION,
  public_url: env.STORAGE_PUBLIC_URL,
  key_pair_id: env.CLOUDFRONT_KEY_PAIR_ID,
  ...(env.CLOUDFRONT_PRIVATE_KEY ? { private_key: env.CLOUDFRONT_PRIVATE_KEY } : {}),
  ...(env.CLOUDFRONT_PRIVATE_KEY_PATH ? { private_key_path: env.CLOUDFRONT_PRIVATE_KEY_PATH } : {}),
  url_ttl_seconds: 4,
  client,
});

const runId = `storage-check-${randomUUID()}`;
const image = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=',
  'base64',
);
const fixtures = [
  { usage: FileUsages.avatar, mime_type: MimeTypes.png, content: image },
  { usage: FileUsages.course_cover, mime_type: MimeTypes.png, content: image },
  {
    usage: FileUsages.lesson_resource,
    mime_type: MimeTypes.pdf,
    content: Buffer.from('%PDF-1.4\n% Academy development storage check\n%%EOF\n'),
  },
].map((fixture) => ({ ...fixture, key: buildStorageKey({ ...fixture, id: runId }) }));
const attemptedKeys = [];
const results = [];
let failure;

const checkHttp = async (name, url, expectedStatus, content, headers = {}) => {
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
    headers,
  });
  const body = Buffer.from(await response.arrayBuffer());
  results.push({
    check: name,
    status: response.status,
    ...(response.headers.get('x-cache') ? { cache: response.headers.get('x-cache') } : {}),
    ...(headers.Origin ? { cors_origin: response.headers.get('access-control-allow-origin') } : {}),
  });
  assert.equal(response.status, expectedStatus, `${name}: unexpected HTTP status`);
  if (content) {
    assert.deepEqual(body, content, `${name}: bytes differ`);
  }
};

try {
  for (const fixture of fixtures) {
    attemptedKeys.push(fixture.key);
    const saved = await storage.save(fixture);
    assert.equal(saved.key, fixture.key);
    assert.equal(saved.size_bytes, fixture.content.byteLength);
    assert.equal(new URL(saved.url).search, '', 'Never persist a signed URL');
    const object = await client.send(
      new GetObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: saved.key }),
    );
    assert.equal(object.ContentType, fixture.mime_type);
    assert.deepEqual(Buffer.from(await object.Body.transformToByteArray()), fixture.content);
    results.push({
      check: 's3-upload-and-read',
      key: fixture.key,
      bytes: saved.size_bytes,
      mime: object.ContentType,
    });
  }
  const privateFile = fixtures.find((file) => file.usage === FileUsages.lesson_resource);
  assert.ok(privateFile);
  const origin = new URL(env.FRONTEND_URL).origin;
  for (const publicFile of fixtures.filter((file) => file.key.startsWith('public/'))) {
    const publicUrl = storage.readUrl(publicFile.key);
    assert.equal(new URL(publicUrl).search, '', 'Public files must not require a signature');
    await checkHttp(`public-unsigned-${publicFile.usage}`, publicUrl, 200, publicFile.content, {
      Origin: origin,
    });
  }

  const privateUrl = storage.readUrl(privateFile.key);
  const signed = new URL(privateUrl);
  assert.ok(signed.searchParams.has('Signature'), 'Private files must be signed');
  assert.equal(signed.searchParams.get('Key-Pair-Id'), env.CLOUDFRONT_KEY_PAIR_ID);
  const remaining = Number(signed.searchParams.get('Expires')) - Math.floor(Date.now() / 1000);
  // The AWS signer rounds expiration to the nearest second.
  assert.ok(remaining > 0 && remaining <= env.CLOUDFRONT_URL_TTL_SECONDS + 1);
  results.push({
    check: 'private-url-ttl',
    configured_seconds: env.CLOUDFRONT_URL_TTL_SECONDS,
    remaining_seconds: remaining,
  });
  await checkHttp('private-signed', privateUrl, 200, privateFile.content, { Origin: origin });
  await checkHttp('private-signed-repeat', privateUrl, 200, privateFile.content);
  await checkHttp('private-unsigned-after-signed-read', storage.publicUrl(privateFile.key), 403);

  const signature = signed.searchParams.get('Signature');
  signed.searchParams.set('Signature', `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`);
  await checkHttp('private-altered-signature', signed.href, 403);
  const expiresSoon = shortLived.readUrl(privateFile.key);
  await checkHttp('private-before-expiry', expiresSoon, 200, privateFile.content);
  const expiresAt = Number(new URL(expiresSoon).searchParams.get('Expires')) * 1000;
  await delay(Math.max(0, expiresAt - Date.now()) + 1500);
  await checkHttp('private-after-expiry', expiresSoon, 403);
  for (const file of fixtures) {
    await checkHttp(
      `s3-origin-anonymous-${file.usage}`,
      `https://${env.AWS_S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${file.key}`,
      403,
    );
  }
} catch (error) {
  // Only sanitized diagnostics are written; never print the signed URL, PEM or credentials.
  failure = error;
} finally {
  for (const key of attemptedKeys) {
    try {
      await storage.remove(key);
      results.push({ check: 's3-delete', key, success: true });
      let absent = false;
      try {
        await client.send(new HeadObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key }));
      } catch (error) {
        if (error?.$metadata?.httpStatusCode === 404) {
          absent = true;
        } else {
          throw error;
        }
      }
      assert.ok(absent, 'Fixture must be absent after deletion');
      results.push({ check: 's3-delete-confirmed', key, status: 404 });
    } catch (error) {
      failure ??= error;
    }
  }
  client.destroy();
}

process.stdout.write(
  `${JSON.stringify(
    {
      success: !failure,
      checks: results,
      ...(failure
        ? {
            error: {
              name: failure.name,
              message: failure.message,
              ...(failure.$metadata?.httpStatusCode
                ? { status: failure.$metadata.httpStatusCode }
                : {}),
            },
          }
        : {}),
    },
    null,
    2,
  )}\n`,
);
if (failure) {
  process.exitCode = 1;
}
