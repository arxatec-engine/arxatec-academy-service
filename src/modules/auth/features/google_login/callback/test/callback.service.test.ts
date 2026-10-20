import { AuthTokenTtlSeconds } from '@/constants/auth';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { auth_provider, user_city, user_role } from '@/generated/enums';
import { hashOneTimeToken } from '@/infrastructure/tokens/one_time_token';
import {
  createOauthAccount,
  createOauthExchangeToken,
  findLinkableUserByEmail,
  findOauthAccountByProviderAccountId,
  markEmailVerified,
} from '@/modules/auth/features/google_login/callback/data/callback.repository';
import type { GoogleProfilePayload } from '@/modules/auth/features/google_login/callback/domain/callback.types';
import { completeGoogleCallback } from '@/modules/auth/features/google_login/callback/presentation/callback.service';
import { createUser } from '@/modules/auth/shared/data/users.repository';
import type { AuthUserRecord } from '@/modules/auth/shared/domain/auth_user.types';
import { isAppError, type AppError } from '@/utils/errors';

jest.mock('@/modules/auth/features/google_login/callback/data/callback.repository', () => ({
  createOauthAccount: jest.fn(),
  createOauthExchangeToken: jest.fn(),
  findLinkableUserByEmail: jest.fn(),
  findOauthAccountByProviderAccountId: jest.fn(),
  markEmailVerified: jest.fn(),
}));

jest.mock('@/modules/auth/shared/data/users.repository', () => ({ createUser: jest.fn() }));

const findOauthAccountMock = jest.mocked(findOauthAccountByProviderAccountId);
const createOauthAccountMock = jest.mocked(createOauthAccount);
const findLinkableUserMock = jest.mocked(findLinkableUserByEmail);
const markEmailVerifiedMock = jest.mocked(markEmailVerified);
const createOauthExchangeTokenMock = jest.mocked(createOauthExchangeToken);
const createUserMock = jest.mocked(createUser);

const NOW = new Date('2026-08-20T12:00:00.000Z');

const profile: GoogleProfilePayload = {
  provider_account_id: '110248495921238986420',
  email: 'maria@estudioqp.pe',
  full_name: 'Maria Quispe Rojas',
  avatar_url: 'https://lh3.googleusercontent.com/a/foto',
  email_verified: true,
};

const createdUser: AuthUserRecord = {
  id: 'usr_nuevo',
  full_name: profile.full_name,
  email: profile.email,
  role: user_role.STUDENT,
  organization: null,
  is_independent: false,
  city: user_city.OTHER,
  city_other: null,
  avatar_key: null, avatar_url: profile.avatar_url,
  email_verified_at: NOW,
  auth_provider: auth_provider.GOOGLE,
  created_at: NOW,
};

const captureError = async (promise: Promise<unknown>): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    if (isAppError(error)) {
      return error;
    }

    throw error;
  }

  throw new Error('Se esperaba un AppError y la promesa se resolvio');
};

const run = (overrides: Partial<GoogleProfilePayload> = {}) =>
  completeGoogleCallback({
    profile: { ...profile, ...overrides },
    redirect_to: '/curso/fundamentos',
    now: NOW,
  });

describe('completeGoogleCallback', () => {
  beforeEach(() => {
    createOauthAccountMock.mockResolvedValue({ id: 'oau_1', user_id: 'usr_1' });
    createOauthExchangeTokenMock.mockResolvedValue('tok_1');
    markEmailVerifiedMock.mockResolvedValue(1);
    createUserMock.mockResolvedValue(createdUser);
  });

  describe('quien vuelve a entrar', () => {
    it('reutiliza el usuario del oauth_account y no toca users', async () => {
      findOauthAccountMock.mockResolvedValue({ id: 'oau_1', user_id: 'usr_1' });

      const result = await run();

      expect(result.redirect_to).toBe('/curso/fundamentos');
      expect(findLinkableUserMock).not.toHaveBeenCalled();
      expect(createUserMock).not.toHaveBeenCalled();
      expect(createOauthAccountMock).not.toHaveBeenCalled();
      expect(createOauthExchangeTokenMock).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'usr_1' }),
      );
    });
  });

  describe('cuenta nueva', () => {
    beforeEach(() => {
      findOauthAccountMock.mockResolvedValue(null);
      findLinkableUserMock.mockResolvedValue(null);
    });

    it('crea el usuario sin contrasena, con auth_provider GOOGLE y su fila de oauth_accounts', async () => {
      await run();

      expect(createUserMock).toHaveBeenCalledWith({
        full_name: profile.full_name,
        email: profile.email,
        password_hash: null,
        organization: null,
        is_independent: false,
        city: user_city.OTHER,
        city_other: null,
        avatar_url: profile.avatar_url,
        email_verified_at: NOW,
        auth_provider: auth_provider.GOOGLE,
      });
      expect(createOauthAccountMock).toHaveBeenCalledWith({
        user_id: createdUser.id,
        provider_account_id: profile.provider_account_id,
      });
    });

    it('deja el correo sin verificar cuando Google no lo verifico', async () => {
      await run({ email_verified: false });

      expect(createUserMock).toHaveBeenCalledWith(
        expect.objectContaining({ email_verified_at: null }),
      );
    });
  });

  describe('enlace con una cuenta que ya existe', () => {
    beforeEach(() => {
      findOauthAccountMock.mockResolvedValue(null);
    });

    it('enlaza sobre el usuario existente y no crea una segunda cuenta', async () => {
      findLinkableUserMock.mockResolvedValue({ id: 'usr_1', email_verified_at: null });

      await run();

      expect(createUserMock).not.toHaveBeenCalled();
      expect(createOauthAccountMock).toHaveBeenCalledWith({
        user_id: 'usr_1',
        provider_account_id: profile.provider_account_id,
      });
      expect(createOauthExchangeTokenMock).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'usr_1' }),
      );
    });

    it('marca el correo como verificado al enlazar', async () => {
      findLinkableUserMock.mockResolvedValue({ id: 'usr_1', email_verified_at: null });

      await run();

      expect(markEmailVerifiedMock).toHaveBeenCalledWith('usr_1', NOW);
    });

    it('no reescribe la fecha de un correo que ya estaba verificado', async () => {
      findLinkableUserMock.mockResolvedValue({
        id: 'usr_1',
        email_verified_at: new Date('2026-05-12T10:00:00.000Z'),
      });

      await run();

      expect(markEmailVerifiedMock).not.toHaveBeenCalled();
    });

    it('rechaza el enlace cuando Google no verifico el correo y no escribe nada', async () => {
      findLinkableUserMock.mockResolvedValue({ id: 'usr_1', email_verified_at: null });

      const error = await captureError(run({ email_verified: false }));

      expect(error.statusCode).toBe(HttpStatusCodes.BAD_REQUEST.code);
      expect(error.meta).toEqual({ code: ErrorCodes.TOKEN_INVALID });
      expect(createOauthAccountMock).not.toHaveBeenCalled();
      expect(markEmailVerifiedMock).not.toHaveBeenCalled();
      expect(createUserMock).not.toHaveBeenCalled();
      expect(createOauthExchangeTokenMock).not.toHaveBeenCalled();
    });
  });

  describe('el codigo de un solo uso', () => {
    beforeEach(() => {
      findOauthAccountMock.mockResolvedValue({ id: 'oau_1', user_id: 'usr_1' });
    });

    it('guarda solo el hash del codigo, nunca el codigo en claro', async () => {
      const result = await run();
      const stored = createOauthExchangeTokenMock.mock.calls[0][0];

      expect(stored.token_hash).toBe(hashOneTimeToken(result.code));
      expect(stored.token_hash).not.toBe(result.code);
      expect(stored.token_hash).toHaveLength(64);
      expect(JSON.stringify(stored)).not.toContain(result.code);
    });

    it('vence a los 60 segundos', async () => {
      await run();

      expect(createOauthExchangeTokenMock.mock.calls[0][0].expires_at).toEqual(
        new Date(NOW.getTime() + AuthTokenTtlSeconds.oauth_exchange_code * 1000),
      );
    });

    it('emite un codigo distinto en cada vuelta', async () => {
      const first = await run();
      const second = await run();

      expect(first.code).not.toBe(second.code);
    });
  });
});
