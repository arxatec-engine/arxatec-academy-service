import { resolveStoredFileUrl } from '@/infrastructure/storage/file_url';
import { storage } from '@/infrastructure/storage/storage';

jest.mock('@/infrastructure/storage/storage', () => ({ storage: { readUrl: jest.fn() } }));

const readUrl = jest.spyOn(storage, 'readUrl');

describe('URLs de lectura', () => {
  it('firma usando la clave persistida y descarta una URL antigua o manipulada', () => {
    readUrl.mockReturnValue('https://cdn.test/signed?Signature=value');
    expect(resolveStoredFileUrl('https://other.test/untrusted', 'avatars/uuid.png')).toBe(
      'https://cdn.test/signed?Signature=value',
    );
    expect(readUrl).toHaveBeenCalledWith('avatars/uuid.png');
  });

  it('mantiene avatares externos y archivos legacy sin clave administrada', () => {
    expect(resolveStoredFileUrl('https://google.test/photo.png', null)).toBe(
      'https://google.test/photo.png',
    );
    expect(resolveStoredFileUrl(null, null)).toBeNull();
    expect(readUrl).not.toHaveBeenCalled();
  });
});
