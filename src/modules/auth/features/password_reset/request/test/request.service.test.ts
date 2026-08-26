import { AuthTokenTtlSeconds } from '@/constants/auth';
import { sendEmail } from '@/infrastructure/email/send_email';
import { buildPasswordResetEmail } from '@/infrastructure/email/templates/password_reset_email';
import { createOneTimeToken } from '@/infrastructure/tokens/one_time_token';
import {
  findPasswordResetRecipient,
  replacePasswordResetToken,
} from '@/modules/auth/features/password_reset/request/data/request.repository';
import { requestPasswordReset } from '@/modules/auth/features/password_reset/request/presentation/request.service';
import { waitForResponseFloor } from '@/modules/auth/features/password_reset/request/utils/response_floor';

jest.mock('@/config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/modules/auth/features/password_reset/request/data/request.repository', () => ({
  findPasswordResetRecipient: jest.fn(),
  replacePasswordResetToken: jest.fn(),
}));

jest.mock('@/modules/auth/features/password_reset/request/utils/response_floor', () => ({
  waitForResponseFloor: jest.fn(),
}));

jest.mock('@/infrastructure/tokens/one_time_token', () => ({ createOneTimeToken: jest.fn() }));

jest.mock('@/infrastructure/email/send_email', () => ({ sendEmail: jest.fn() }));

jest.mock('@/infrastructure/email/templates/password_reset_email', () => ({
  buildPasswordResetEmail: jest.fn(),
}));

const findRecipient = jest.mocked(findPasswordResetRecipient);
const replaceToken = jest.mocked(replacePasswordResetToken);
const waitFloor = jest.mocked(waitForResponseFloor);
const createToken = jest.mocked(createOneTimeToken);
const send = jest.mocked(sendEmail);
const buildEmail = jest.mocked(buildPasswordResetEmail);

const EXPIRES_AT = new Date('2026-08-20T13:00:00.000Z');

const EMAIL_CONTENT = {
  subject: 'Restablece tu contraseña de Arxatec Academy',
  html: '<p>enlace</p>',
  text: 'enlace',
};

const arrangeExistingRecipient = (): void => {
  findRecipient.mockResolvedValue({ id: 'usr_1', email: 'maria@estudioqp.pe' });
  createToken.mockReturnValue({
    token: 'token_claro',
    token_hash: 'a'.repeat(64),
    expires_at: EXPIRES_AT,
  });
  replaceToken.mockResolvedValue({ id: 'tok_1', expires_at: EXPIRES_AT });
  buildEmail.mockReturnValue(EMAIL_CONTENT);
  send.mockResolvedValue(undefined);
};

describe('requestPasswordReset', () => {
  it('emite un token de 1 hora y manda el correo cuando el usuario existe', async () => {
    arrangeExistingRecipient();

    await requestPasswordReset({ email: 'maria@estudioqp.pe' });

    expect(createToken).toHaveBeenCalledWith(AuthTokenTtlSeconds.password_reset, expect.any(Date));
    expect(replaceToken).toHaveBeenCalledWith({
      user_id: 'usr_1',
      token_hash: 'a'.repeat(64),
      expires_at: EXPIRES_AT,
      invalidated_at: expect.any(Date),
    });
    expect(send).toHaveBeenCalledWith({ to: 'maria@estudioqp.pe', ...EMAIL_CONTENT });
  });

  it('guarda el hash y nunca el token en claro', async () => {
    arrangeExistingRecipient();

    await requestPasswordReset({ email: 'maria@estudioqp.pe' });

    expect(JSON.stringify(replaceToken.mock.calls)).not.toContain('token_claro');
  });

  it('invalida los tokens anteriores con la misma fecha con la que emite el nuevo', async () => {
    arrangeExistingRecipient();

    await requestPasswordReset({ email: 'maria@estudioqp.pe' });

    const issued_at = createToken.mock.calls[0]?.[1];
    const invalidated_at = replaceToken.mock.calls[0]?.[0].invalidated_at;

    expect(invalidated_at).toBe(issued_at);
  });

  it('pasa el redirect_to al correo', async () => {
    arrangeExistingRecipient();

    await requestPasswordReset({ email: 'maria@estudioqp.pe', redirect_to: '/curso/fundamentos' });

    expect(buildEmail).toHaveBeenCalledWith({
      token: 'token_claro',
      redirect_to: '/curso/fundamentos',
    });
  });

  it('no escribe nada ni manda correo cuando el usuario no existe, y no lanza', async () => {
    findRecipient.mockResolvedValue(null);

    await expect(requestPasswordReset({ email: 'nadie@x.pe' })).resolves.toBeUndefined();

    expect(replaceToken).not.toHaveBeenCalled();
    expect(createToken).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('responde igual aunque el correo falle al enviarse', async () => {
    arrangeExistingRecipient();
    send.mockRejectedValue(new Error('smtp caido'));

    await expect(requestPasswordReset({ email: 'maria@estudioqp.pe' })).resolves.toBeUndefined();
  });

  it('espera el suelo de respuesta en las dos ramas', async () => {
    arrangeExistingRecipient();
    await requestPasswordReset({ email: 'maria@estudioqp.pe' });
    expect(waitFloor).toHaveBeenCalledTimes(1);

    waitFloor.mockClear();
    findRecipient.mockResolvedValue(null);
    await requestPasswordReset({ email: 'nadie@x.pe' });
    expect(waitFloor).toHaveBeenCalledTimes(1);
  });

  it('tarda lo mismo exista o no el correo', async () => {
    const actual = jest.requireActual<{
      waitForResponseFloor: (started_at: number, minimum_ms?: number) => Promise<void>;
    }>('@/modules/auth/features/password_reset/request/utils/response_floor');

    waitFloor.mockImplementation(async (started_at) =>
      actual.waitForResponseFloor(started_at, 150),
    );

    arrangeExistingRecipient();
    const before_existing = Date.now();
    await requestPasswordReset({ email: 'maria@estudioqp.pe' });
    const existing_ms = Date.now() - before_existing;

    findRecipient.mockResolvedValue(null);
    const before_missing = Date.now();
    await requestPasswordReset({ email: 'nadie@x.pe' });
    const missing_ms = Date.now() - before_missing;

    expect(existing_ms).toBeGreaterThanOrEqual(140);
    expect(missing_ms).toBeGreaterThanOrEqual(140);
    expect(Math.abs(existing_ms - missing_ms)).toBeLessThan(50);
  });
});
