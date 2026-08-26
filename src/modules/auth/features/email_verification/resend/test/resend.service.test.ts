import { AuthPolicy, AuthTokenTtlSeconds } from '@/constants/auth';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { sendEmail } from '@/infrastructure/email/send_email';
import { hashOneTimeToken } from '@/infrastructure/tokens/one_time_token';
import {
  findLastEmailVerificationSentAt,
  rotateEmailVerificationToken,
} from '@/modules/auth/features/email_verification/resend/data/resend.repository';
import { resendVerificationService } from '@/modules/auth/features/email_verification/resend/presentation/resend.service';

jest.mock('@/modules/auth/features/email_verification/resend/data/resend.repository', () => ({
  findLastEmailVerificationSentAt: jest.fn(),
  rotateEmailVerificationToken: jest.fn(),
}));

jest.mock('@/infrastructure/email/send_email', () => ({ sendEmail: jest.fn() }));

const findLastSentAtMock = jest.mocked(findLastEmailVerificationSentAt);
const rotateTokenMock = jest.mocked(rotateEmailVerificationToken);
const sendEmailMock = jest.mocked(sendEmail);

const NOW = new Date('2026-08-20T12:00:00.000Z');

const unverified = {
  user_id: 'usr_1',
  email: 'maria@estudioqp.pe',
  email_verified_at: null,
};

describe('resendVerificationService', () => {
  it('rota el token y envia el correo cuando el usuario nunca pidio uno', async () => {
    findLastSentAtMock.mockResolvedValue(null);
    rotateTokenMock.mockResolvedValue('tok_2');
    sendEmailMock.mockResolvedValue();

    await expect(resendVerificationService(unverified, NOW)).resolves.toEqual({
      already_verified: false,
      retry_after_seconds: AuthPolicy.resend_cooldown_seconds,
    });

    expect(rotateTokenMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it('invalida los tokens anteriores en la misma escritura que crea el nuevo', async () => {
    findLastSentAtMock.mockResolvedValue(null);
    rotateTokenMock.mockResolvedValue('tok_2');
    sendEmailMock.mockResolvedValue();

    await resendVerificationService(unverified, NOW);

    const rotation = rotateTokenMock.mock.calls[0][0];

    expect(rotation.user_id).toBe('usr_1');
    expect(rotation.invalidated_at).toEqual(NOW);
    expect(rotation.expires_at).toEqual(
      new Date(NOW.getTime() + AuthTokenTtlSeconds.email_verification * 1000),
    );
  });

  it('guarda solo el hash y manda por correo el token en claro que le corresponde', async () => {
    findLastSentAtMock.mockResolvedValue(null);
    rotateTokenMock.mockResolvedValue('tok_2');
    sendEmailMock.mockResolvedValue();

    await resendVerificationService(unverified, NOW);

    const rotation = rotateTokenMock.mock.calls[0][0];
    const message = sendEmailMock.mock.calls[0][0];
    const link_token = /token=([A-Za-z0-9_-]+)/.exec(message.text);

    expect(rotation.token_hash).toHaveLength(64);
    expect(link_token).not.toBeNull();
    expect(hashOneTimeToken(link_token === null ? '' : link_token[1])).toBe(rotation.token_hash);
    expect(message.to).toBe('maria@estudioqp.pe');
    expect(message.text).not.toContain(rotation.token_hash);
  });

  it('rechaza con 429 RESEND_COOLDOWN y los segundos que faltan si aun no toca', async () => {
    findLastSentAtMock.mockResolvedValue(new Date(NOW.getTime() - 10_000));

    await expect(resendVerificationService(unverified, NOW)).rejects.toMatchObject({
      statusCode: HttpStatusCodes.TOO_MANY_REQUESTS.code,
      meta: { code: ErrorCodes.RESEND_COOLDOWN, retry_after_seconds: 35 },
    });

    expect(rotateTokenMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('usa el mensaje de cooldown del catalogo de constantes', async () => {
    findLastSentAtMock.mockResolvedValue(new Date(NOW.getTime() - 10_000));

    await expect(resendVerificationService(unverified, NOW)).rejects.toThrow(
      AuthMessages.email_verification.resend_cooldown,
    );
  });

  it('permite el reenvio en cuanto se cumplen los 45 s', async () => {
    findLastSentAtMock.mockResolvedValue(
      new Date(NOW.getTime() - AuthPolicy.resend_cooldown_seconds * 1000),
    );
    rotateTokenMock.mockResolvedValue('tok_2');
    sendEmailMock.mockResolvedValue();

    await expect(resendVerificationService(unverified, NOW)).resolves.toEqual({
      already_verified: false,
      retry_after_seconds: AuthPolicy.resend_cooldown_seconds,
    });
  });

  it('no manda nada a un correo ya verificado y no consulta la base', async () => {
    await expect(
      resendVerificationService(
        { ...unverified, email_verified_at: new Date('2026-08-19T12:00:00.000Z') },
        NOW,
      ),
    ).resolves.toEqual({ already_verified: true, retry_after_seconds: 0 });

    expect(findLastSentAtMock).not.toHaveBeenCalled();
    expect(rotateTokenMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
