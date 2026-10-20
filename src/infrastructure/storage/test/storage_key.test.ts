import { FileUsages, MimeTypes } from '@/constants/files';
import {
  buildStorageKey,
  isPublicStorageKey,
  isSafeStorageKey,
} from '@/infrastructure/storage/storage_key';

describe('rutas públicas y privadas', () => {
  it.each([
    [FileUsages.avatar, MimeTypes.png, 'public/avatars/fixture.png'],
    [FileUsages.course_cover, MimeTypes.webp, 'public/course_covers/fixture.webp'],
    [FileUsages.lesson_resource, MimeTypes.pdf, 'private/lesson_resources/fixture.pdf'],
  ])('crea la ruta correspondiente para %s', (usage, mime_type, expected) => {
    const key = buildStorageKey({ usage, mime_type, id: 'fixture' });
    expect(key).toBe(expected);
    expect(isSafeStorageKey(key)).toBe(true);
    expect(isPublicStorageKey(key)).toBe(expected.startsWith('public/'));
  });

  it.each([
    'public/../avatars/fixture.png',
    'public/private/avatars/fixture.png',
    '/public/avatars/fixture.png',
    'private/lesson_resources/fixture.pdf?token=x',
    'public/avatars/%2e%2e.png',
    'private/lesson_resources/../../fixture.pdf',
  ])('rechaza la ruta insegura %s', (key) => {
    expect(isSafeStorageKey(key)).toBe(false);
  });

  it('admite referencias legacy y las mantiene fuera del acceso público explícito', () => {
    expect(isSafeStorageKey('avatars/legacy.png')).toBe(true);
    expect(isPublicStorageKey('avatars/legacy.png')).toBe(false);
  });
});
