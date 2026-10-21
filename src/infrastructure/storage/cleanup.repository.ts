import { randomUUID } from 'node:crypto';

import { prisma } from '@/config/prisma_client';
import { StorageCleanupPolicy } from '@/constants/files';
import { Prisma } from '@/generated/client';

export interface StorageDeletion {
  file_key: string;
  attempts: number;
  lease_token: string;
}

export const queueStorageDeletion = async (file_key: string): Promise<void> => {
  await prisma.storage_deletions.upsert({
    where: { file_key },
    create: { file_key },
    update: {},
  });
};

export const claimStorageDeletion = async (file_key?: string): Promise<StorageDeletion | null> => {
  const token = randomUUID();
  const keyFilter = file_key === undefined ? Prisma.empty : Prisma.sql`AND file_key = ${file_key}`;
  const rows = await prisma.$queryRaw<StorageDeletion[]>(Prisma.sql`
    UPDATE storage_deletions
    SET lease_token = ${token}, attempts = attempts + 1,
        next_attempt_at = CURRENT_TIMESTAMP + ${StorageCleanupPolicy.lease_ms} * INTERVAL '1 millisecond'
    WHERE file_key = (
      SELECT file_key FROM storage_deletions
      WHERE next_attempt_at <= CURRENT_TIMESTAMP ${keyFilter}
      ORDER BY next_attempt_at, created_at, file_key
      FOR UPDATE SKIP LOCKED LIMIT 1
    )
    RETURNING file_key, attempts, lease_token
  `);
  return rows[0] ?? null;
};

export const hasStoredFileReferences = async (file_key: string): Promise<boolean> => {
  const counts = await Promise.all([
    prisma.lesson_resources.count({ where: { file_key } }),
    prisma.courses.count({ where: { cover_image_key: file_key } }),
    prisma.users.count({ where: { avatar_key: file_key } }),
  ]);
  return counts.some((count) => count > 0);
};

export const completeStorageDeletion = ({ file_key, lease_token }: StorageDeletion) =>
  prisma.storage_deletions.deleteMany({ where: { file_key, lease_token } });

export const retryStorageDeletion = (job: StorageDeletion) => {
  const delay = Math.min(
    StorageCleanupPolicy.retry_delay_ms * 2 ** Math.min(job.attempts - 1, 10),
    StorageCleanupPolicy.max_retry_delay_ms,
  );
  return prisma.storage_deletions.updateMany({
    where: { file_key: job.file_key, lease_token: job.lease_token },
    data: { lease_token: null, next_attempt_at: new Date(Date.now() + delay) },
  });
};
