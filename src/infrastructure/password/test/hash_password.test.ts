import { hashPassword, verifyPassword } from '@/infrastructure/password/hash_password';

describe('hashPassword', () => {
  it('produce un hash argon2id', async () => {
    const digest = await hashPassword('unaClaveLarga');

    expect(digest.startsWith('$argon2id$')).toBe(true);
  });

  it('nunca deja la contrasena en claro dentro del hash', async () => {
    const digest = await hashPassword('unaClaveLarga');

    expect(digest).not.toContain('unaClaveLarga');
  });

  it('usa una sal distinta en cada llamada', async () => {
    const [first, second] = await Promise.all([
      hashPassword('unaClaveLarga'),
      hashPassword('unaClaveLarga'),
    ]);

    expect(first).not.toBe(second);
  });
});

describe('verifyPassword', () => {
  it('acepta la contrasena correcta', async () => {
    const digest = await hashPassword('unaClaveLarga');

    await expect(verifyPassword(digest, 'unaClaveLarga')).resolves.toBe(true);
  });

  it('rechaza una contrasena incorrecta', async () => {
    const digest = await hashPassword('unaClaveLarga');

    await expect(verifyPassword(digest, 'otraClaveLarga')).resolves.toBe(false);
  });

  it('rechaza sin lanzar cuando la cuenta no tiene hash (cuenta de Google)', async () => {
    await expect(verifyPassword(null, 'unaClaveLarga')).resolves.toBe(false);
  });

  it('rechaza sin lanzar cuando el hash guardado esta corrupto', async () => {
    await expect(verifyPassword('no-es-un-hash', 'unaClaveLarga')).resolves.toBe(false);
  });
});
