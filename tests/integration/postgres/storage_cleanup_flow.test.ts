import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { env } from '@/config/env';
import { disconnectPrisma, prisma } from '@/config/prisma_client';
import { FileUsages, MimeTypes, type FileUsage } from '@/constants/files';
import {
  course_level,
  course_status,
  course_topic,
  lesson_type,
  user_city,
} from '@/generated/enums';
import { removeStoredFile } from '@/infrastructure/storage/cleanup';
import {
  claimStorageDeletion,
  completeStorageDeletion,
  queueStorageDeletion,
} from '@/infrastructure/storage/cleanup.repository';
import { createLocalStorage } from '@/infrastructure/storage/local_storage.adapter';
import { storage } from '@/infrastructure/storage/storage';
import { buildStorageKey } from '@/infrastructure/storage/storage_key';
import type { StoragePort } from '@/infrastructure/storage/storage.types';

jest.mock('@/infrastructure/storage/storage', () => ({ storage: { remove: jest.fn() } }));
jest.mock('@/config/logger', () => ({ logger: { warn: jest.fn() } }));

const courseIds: string[] = [];
const userIds: string[] = [];
const keys: string[] = [];
const remove = jest.spyOn(storage, 'remove');
let root: string;
let files: StoragePort;

const saveFile = async (usage: FileUsage = FileUsages.lesson_resource): Promise<string> => {
  const key = buildStorageKey({ usage, mime_type: MimeTypes.png });
  await files.save({ key, mime_type: MimeTypes.png, content: Buffer.from('fixture') });
  keys.push(key);
  return key;
};

const createCourse = async (cover_image_key: string | null = null) => {
  const course = await prisma.courses.create({
    data: {
      slug: `storage-cleanup-${randomUUID()}`,
      title: 'Storage cleanup fixture',
      short_description: 'Fixture',
      long_description: 'Fixture',
      topic: course_topic.FIRST_STEPS,
      level: course_level.INTRODUCTORY,
      catalog_order: 1,
      cover_image_key,
      cover_image_url: cover_image_key === null ? null : files.publicUrl(cover_image_key),
    },
    select: { id: true },
  });
  courseIds.push(course.id);
  return course;
};

const createLesson = (course_id: string, file_key: string | null) =>
  prisma.lessons.create({
    data: {
      course_id,
      slug: 'fixture',
      title: 'Fixture',
      description: 'Fixture',
      type: lesson_type.ARTICLE,
      position: 1,
      resources: {
        create: {
          title: 'Fixture',
          position: 1,
          file_key,
          file_url:
            file_key === null ? 'https://external.test/document.pdf' : files.publicUrl(file_key),
          mime_type: MimeTypes.png,
          size_bytes: 7,
        },
      },
    },
    select: { id: true },
  });

const pending = (file_key: string) => prisma.storage_deletions.findUnique({ where: { file_key } });
const expectRemoved = async (file_key: string): Promise<void> => {
  await expect(readFile(join(root, file_key))).rejects.toMatchObject({ code: 'ENOENT' });
  expect(await pending(file_key)).toBeNull();
};

beforeAll(async () => {
  if (env.NODE_ENV !== 'test' || !new URL(env.DATABASE_URL).pathname.includes('test')) {
    throw new Error('Storage integration requires a disposable test database');
  }
  root = await mkdtemp(join(tmpdir(), 'academy-storage-cleanup-'));
  files = createLocalStorage({ root_path: root, public_url: 'http://files.test' });
});

beforeEach(() => {
  remove.mockReset().mockImplementation((key) => files.remove(key));
});

afterEach(async () => {
  await prisma.courses.deleteMany({ where: { id: { in: courseIds.splice(0) } } });
  await prisma.users.deleteMany({ where: { id: { in: userIds.splice(0) } } });
  await prisma.storage_deletions.deleteMany({ where: { file_key: { in: keys.splice(0) } } });
});

afterAll(async () => {
  await disconnectPrisma();
  if (root) {
    await rm(root, { recursive: true, force: true });
  }
});

it('borrar una lección registra y elimina todos sus archivos', async () => {
  const key = await saveFile();
  const course = await createCourse();
  const lesson = await createLesson(course.id, key);
  await prisma.lessons.delete({ where: { id: lesson.id } });
  expect(await pending(key)).not.toBeNull();
  await removeStoredFile(key);
  await expectRemoved(key);
});

it('conserva un recurso duplicado hasta que se elimina su última referencia', async () => {
  const key = await saveFile();
  const original = await createCourse();
  const duplicate = await createCourse();
  const first = await createLesson(original.id, key);
  const second = await createLesson(duplicate.id, key);
  await prisma.lessons.delete({ where: { id: first.id } });
  await removeStoredFile(key);
  expect(remove).not.toHaveBeenCalled();
  expect(await readFile(join(root, key), 'utf8')).toBe('fixture');
  expect(await pending(key)).toBeNull();
  await prisma.lessons.delete({ where: { id: second.id } });
  await removeStoredFile(key);
  expect(remove).toHaveBeenCalledTimes(1);
  await expectRemoved(key);
});

it('borrar un curso en cascada registra su portada y los recursos de sus lecciones', async () => {
  const cover = await saveFile(FileUsages.course_cover);
  const resource = await saveFile();
  const course = await createCourse(cover);
  await createLesson(course.id, resource);
  await prisma.courses.delete({ where: { id: course.id } });
  expect(await pending(cover)).not.toBeNull();
  expect(await pending(resource)).not.toBeNull();
  await removeStoredFile(cover);
  await removeStoredFile(resource);
  await expectRemoved(cover);
  await expectRemoved(resource);
});

it('sustituir una portada elimina solo la antigua y archivar conserva la actual', async () => {
  const previous = await saveFile(FileUsages.course_cover);
  const current = await saveFile(FileUsages.course_cover);
  const course = await createCourse(previous);
  await prisma.courses.update({
    where: { id: course.id },
    data: {
      cover_image_key: current,
      cover_image_url: files.publicUrl(current),
    },
  });
  await removeStoredFile(previous);
  await expectRemoved(previous);
  await prisma.courses.update({
    where: { id: course.id },
    data: { status: course_status.ARCHIVED },
  });
  expect(await pending(current)).toBeNull();
  expect(await readFile(join(root, current), 'utf8')).toBe('fixture');
});

it('sustituir el avatar o borrar la cuenta registra las fotos que dejan de utilizarse', async () => {
  const previous = await saveFile(FileUsages.avatar);
  const current = await saveFile(FileUsages.avatar);
  const user = await prisma.users.create({
    data: {
      full_name: 'Storage fixture',
      email: `storage-${randomUUID()}@example.test`,
      city: user_city.LIMA,
      avatar_key: previous,
      avatar_url: files.publicUrl(previous),
    },
    select: { id: true },
  });
  userIds.push(user.id);
  await prisma.users.update({
    where: { id: user.id },
    data: {
      avatar_key: current,
      avatar_url: files.publicUrl(current),
    },
  });
  await removeStoredFile(previous);
  await expectRemoved(previous);
  await prisma.users.delete({ where: { id: user.id } });
  expect(await pending(current)).not.toBeNull();
  await removeStoredFile(current);
  await expectRemoved(current);
});

it('un fallo de S3 deja un reintento durable y el siguiente intento completa el borrado', async () => {
  const key = await saveFile();
  const course = await createCourse();
  const lesson = await createLesson(course.id, key);
  await prisma.lessons.delete({ where: { id: lesson.id } });
  remove.mockRejectedValueOnce(new Error('S3 unavailable'));
  await removeStoredFile(key);
  const queued = await pending(key);
  expect(queued).toMatchObject({ attempts: 1, lease_token: null });
  expect(queued?.next_attempt_at.getTime()).toBeGreaterThan(Date.now());
  expect(await readFile(join(root, key), 'utf8')).toBe('fixture');
  await prisma.storage_deletions.update({
    where: { file_key: key },
    data: { next_attempt_at: new Date(0) },
  });
  await removeStoredFile(key);
  await expectRemoved(key);
});

it('el rollback de la eliminación también revierte el trabajo de limpieza', async () => {
  const key = await saveFile();
  const course = await createCourse();
  const lesson = await createLesson(course.id, key);
  await expect(
    prisma.$transaction(async (tx) => {
      await tx.lessons.delete({ where: { id: lesson.id } });
      throw new Error('rollback');
    }),
  ).rejects.toThrow('rollback');
  expect(await pending(key)).toBeNull();
  expect(await readFile(join(root, key), 'utf8')).toBe('fixture');
  expect(remove).not.toHaveBeenCalled();
});

it('reserva cada trabajo para un solo worker y recupera las reservas vencidas', async () => {
  const key = await saveFile();
  await queueStorageDeletion(key);
  const claims = await Promise.all([claimStorageDeletion(key), claimStorageDeletion(key)]);
  const claimed = claims.find((job) => job !== null);
  expect(claims.filter((job) => job !== null)).toHaveLength(1);
  if (!claimed) {
    throw new Error('Expected a claimed job');
  }
  await prisma.storage_deletions.update({
    where: { file_key: key },
    data: { next_attempt_at: new Date(0) },
  });
  const recovered = await claimStorageDeletion(key);
  expect(recovered?.attempts).toBe(2);
  expect(recovered?.lease_token).not.toBe(claimed.lease_token);
  expect(await completeStorageDeletion(claimed)).toEqual({ count: 0 });
  expect(await pending(key)).not.toBeNull();
  if (recovered) {
    await completeStorageDeletion(recovered);
  }
});

it('las URLs externas sin clave no generan borrados de objetos', async () => {
  const pendingBefore = await prisma.storage_deletions.count();
  const course = await createCourse();
  await createLesson(course.id, null);
  await prisma.courses.delete({ where: { id: course.id } });
  expect(await prisma.storage_deletions.count()).toBe(pendingBefore);
  expect(remove).not.toHaveBeenCalled();
});
