import { hashPassword, verifyPassword } from '@/infrastructure/password/hash_password';
import { DECOY_PASSWORD_HASH } from '@/modules/auth/features/email_login/login/domain/decoy_password_hash';

const PARAMETERS_SEGMENTS = 4;

const readParameters = (hash: string): string =>
  hash.split('$').slice(0, PARAMETERS_SEGMENTS).join('$');

describe('DECOY_PASSWORD_HASH', () => {
  it('usa los mismos parametros de argon2 que hashPassword', async () => {
    const produced = await hashPassword('una-clave-cualquiera-de-produccion');

    expect(readParameters(DECOY_PASSWORD_HASH)).toBe(readParameters(produced));
  });

  it('no valida ninguna contrasena, pero sigue costando un verify completo', async () => {
    await expect(verifyPassword(DECOY_PASSWORD_HASH, 'lo-que-sea')).resolves.toBe(false);
  });
});
