import { AuthPolicy, AuthTokenTtlSeconds } from '@/constants/auth';
import {
  createOneTimeToken,
  hashOneTimeToken,
  isTokenUsable,
} from '@/infrastructure/tokens/one_time_token';

describe('hashOneTimeToken', () => {
  it('devuelve un SHA-256 en hexadecimal de 64 caracteres', () => {
    const digest = hashOneTimeToken('un-token');

    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('es determinista para la misma entrada', () => {
    expect(hashOneTimeToken('un-token')).toBe(hashOneTimeToken('un-token'));
  });

  it('cambia por completo con un solo caracter distinto', () => {
    expect(hashOneTimeToken('un-token')).not.toBe(hashOneTimeToken('un-tokeN'));
  });
});

describe('createOneTimeToken', () => {
  const now = new Date('2026-08-20T12:00:00.000Z');

  it('genera un token con la entropia declarada en la politica', () => {
    const { token } = createOneTimeToken(AuthTokenTtlSeconds.email_verification, now);

    expect(Buffer.from(token, 'base64url')).toHaveLength(AuthPolicy.one_time_token_bytes);
  });

  it('devuelve el hash del token que genera', () => {
    const { token, token_hash } = createOneTimeToken(AuthTokenTtlSeconds.password_reset, now);

    expect(token_hash).toBe(hashOneTimeToken(token));
  });

  it('nunca devuelve el mismo token dos veces', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => createOneTimeToken(60, now).token));

    expect(tokens.size).toBe(50);
  });

  it('calcula expires_at sumando el ttl en segundos', () => {
    const { expires_at } = createOneTimeToken(AuthTokenTtlSeconds.password_reset, now);

    expect(expires_at.toISOString()).toBe('2026-08-20T13:00:00.000Z');
  });

  it('usa la url segura de base64: sin +, / ni =', () => {
    const { token } = createOneTimeToken(60, now);

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('isTokenUsable', () => {
  const now = new Date('2026-08-20T12:00:00.000Z');

  it('acepta un token vigente y sin consumir', () => {
    const token = { expires_at: new Date('2026-08-20T12:00:01.000Z'), consumed_at: null };

    expect(isTokenUsable(token, now)).toBe(true);
  });

  it('rechaza un token ya consumido', () => {
    const token = {
      expires_at: new Date('2026-08-20T13:00:00.000Z'),
      consumed_at: new Date('2026-08-20T11:00:00.000Z'),
    };

    expect(isTokenUsable(token, now)).toBe(false);
  });

  it('rechaza un token vencido justo en el limite', () => {
    const token = { expires_at: now, consumed_at: null };

    expect(isTokenUsable(token, now)).toBe(false);
  });
});
