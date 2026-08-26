import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { hashOneTimeToken } from '@/infrastructure/tokens/one_time_token';
import {
  consumeEmailVerificationToken,
  findEmailVerificationTokenByHash,
} from '@/modules/auth/features/email_verification/verify/data/verify.repository';
import type { EmailVerificationTokenRecord } from '@/modules/auth/features/email_verification/verify/domain/verify.types';
import { verifyEmailService } from '@/modules/auth/features/email_verification/verify/presentation/verify.service';

jest.mock('@/modules/auth/features/email_verification/verify/data/verify.repository', () => ({
  findEmailVerificationTokenByHash: jest.fn(),
  consumeEmailVerificationToken: jest.fn(),
}));

const findTokenMock = jest.mocked(findEmailVerificationTokenByHash);
const consumeTokenMock = jest.mocked(consumeEmailVerificationToken);

const NOW = new Date('2026-08-20T12:00:00.000Z');
const TOKEN = 'wLQ2n5s7Xk9dRt1uYbHfVcJgAeMpZoQi';

const tokenRecord = (
  overrides: Partial<EmailVerificationTokenRecord> = {},
): EmailVerificationTokenRecord => ({
  id: 'tok_1',
  user_id: 'usr_1',
  expires_at: new Date('2026-08-21T11:00:00.000Z'),
  consumed_at: null,
  user: { id: 'usr_1', email_verified_at: null },
  ...overrides,
});

describe('verifyEmailService', () => {
  it('busca el token por su hash SHA-256, nunca por el token en claro', async () => {
    findTokenMock.mockResolvedValue(tokenRecord());
    consumeTokenMock.mockResolvedValue(1);

    await verifyEmailService({ token: TOKEN }, NOW);

    const token_hash = hashOneTimeToken(TOKEN);

    expect(findTokenMock).toHaveBeenCalledWith(token_hash);
    expect(token_hash).toHaveLength(64);
    expect(token_hash).not.toContain(TOKEN);
  });

  it('marca el correo verificado y consume el token en el camino feliz', async () => {
    findTokenMock.mockResolvedValue(tokenRecord());
    consumeTokenMock.mockResolvedValue(1);

    await expect(verifyEmailService({ token: TOKEN }, NOW)).resolves.toEqual({
      already_verified: false,
    });

    expect(consumeTokenMock).toHaveBeenCalledWith({
      token_id: 'tok_1',
      user_id: 'usr_1',
      verified_at: NOW,
    });
  });

  it('es idempotente: un correo ya verificado responde sin error y sin volver a escribir', async () => {
    findTokenMock.mockResolvedValue(
      tokenRecord({
        consumed_at: new Date('2026-08-20T11:00:00.000Z'),
        user: { id: 'usr_1', email_verified_at: new Date('2026-08-20T11:00:00.000Z') },
      }),
    );

    await expect(verifyEmailService({ token: TOKEN }, NOW)).resolves.toEqual({
      already_verified: true,
    });

    expect(consumeTokenMock).not.toHaveBeenCalled();
  });

  it('trata como ya verificado la carrera en la que otra peticion consumio el token', async () => {
    findTokenMock.mockResolvedValue(tokenRecord());
    consumeTokenMock.mockResolvedValue(0);

    await expect(verifyEmailService({ token: TOKEN }, NOW)).resolves.toEqual({
      already_verified: true,
    });
  });

  it('rechaza con 400 TOKEN_INVALID un token que no existe', async () => {
    findTokenMock.mockResolvedValue(null);

    await expect(verifyEmailService({ token: TOKEN }, NOW)).rejects.toMatchObject({
      statusCode: HttpStatusCodes.BAD_REQUEST.code,
      meta: { code: ErrorCodes.TOKEN_INVALID },
    });
    await expect(verifyEmailService({ token: TOKEN }, NOW)).rejects.toThrow(
      AuthMessages.email_verification.token_invalid,
    );
  });

  it('rechaza con 400 TOKEN_INVALID un token vencido de un correo sin verificar', async () => {
    findTokenMock.mockResolvedValue(
      tokenRecord({ expires_at: new Date('2026-08-20T11:59:59.000Z') }),
    );

    await expect(verifyEmailService({ token: TOKEN }, NOW)).rejects.toMatchObject({
      statusCode: HttpStatusCodes.BAD_REQUEST.code,
      meta: { code: ErrorCodes.TOKEN_INVALID },
    });
    expect(consumeTokenMock).not.toHaveBeenCalled();
  });

  it('rechaza con 400 TOKEN_INVALID un token ya consumido de un correo sin verificar', async () => {
    findTokenMock.mockResolvedValue(
      tokenRecord({ consumed_at: new Date('2026-08-20T11:00:00.000Z') }),
    );

    await expect(verifyEmailService({ token: TOKEN }, NOW)).rejects.toMatchObject({
      statusCode: HttpStatusCodes.BAD_REQUEST.code,
      meta: { code: ErrorCodes.TOKEN_INVALID },
    });
    expect(consumeTokenMock).not.toHaveBeenCalled();
  });

  it('vence en el instante exacto de expires_at', async () => {
    findTokenMock.mockResolvedValue(tokenRecord({ expires_at: NOW }));

    await expect(verifyEmailService({ token: TOKEN }, NOW)).rejects.toMatchObject({
      statusCode: HttpStatusCodes.BAD_REQUEST.code,
    });
  });
});
