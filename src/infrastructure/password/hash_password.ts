import { argon2id, hash, verify } from 'argon2';

const ARGON2_OPTIONS = { type: argon2id } as const;

export const hashPassword = async (plain_password: string): Promise<string> =>
  hash(plain_password, ARGON2_OPTIONS);

export const verifyPassword = async (
  password_hash: string | null,
  plain_password: string,
): Promise<boolean> => {
  if (password_hash === null || password_hash.length === 0) {
    return false;
  }

  try {
    return await verify(password_hash, plain_password);
  } catch {
    return false;
  }
};
