import express, { type Express } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { ApiPrefix, AuthEndpoints, AuthRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { ValidationKeys } from '@/constants/validation_keys';
import { auth_provider, user_city, user_role } from '@/generated/enums';
import { registerErrorHandler } from '@/middlewares/error_handler';
import { googleExchangeController } from '@/modules/auth/features/google_login/exchange/presentation/exchange.controller';
import { exchangeGoogleCode } from '@/modules/auth/features/google_login/exchange/presentation/exchange.service';
import type { ApiSession } from '@/modules/auth/shared/domain/session.types';
import { AppError } from '@/utils/errors';

jest.mock('@/modules/auth/features/google_login/exchange/presentation/exchange.service', () => ({
  exchangeGoogleCode: jest.fn(),
}));

const exchangeGoogleCodeMock = jest.mocked(exchangeGoogleCode);

const EXCHANGE_PATH = `${ApiPrefix}${AuthRoutePrefix}${AuthEndpoints.google_exchange}`;

const errorEnvelopeSchema = z.object({
  status: z.number(),
  description: z.string(),
  path: z.string(),
  meta: z.object({
    code: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
});

const readErrorEnvelope = (body: unknown): z.infer<typeof errorEnvelopeSchema> =>
  errorEnvelopeSchema.parse(body);

const sessionResult: ApiSession = {
  token: 'jwt.firmado',
  expires_at: '2026-09-19T12:00:00.000Z',
  user: {
    id: 'usr_1',
    full_name: 'Maria Quispe Rojas',
    email: 'maria@estudioqp.pe',
    role: user_role.STUDENT,
    organization: null,
    is_independent: false,
    city: user_city.OTHER,
    city_other: null,
    avatar_url: 'https://lh3.googleusercontent.com/a/foto',
    email_verified_at: '2026-08-20T12:00:00.000Z',
    auth_provider: auth_provider.GOOGLE,
    created_at: '2026-05-12T10:00:00.000Z',
  },
};

const buildApp = (): Express => {
  const app = express();

  app.use(express.json());
  app.post(EXCHANGE_PATH, googleExchangeController);
  registerErrorHandler(app);

  return app;
};

describe('googleExchangeController', () => {
  it('responde 200 con el sobre del contrato y la sesion en data', async () => {
    exchangeGoogleCodeMock.mockResolvedValue(sessionResult);

    const response = await request(buildApp())
      .post(EXCHANGE_PATH)
      .send({ code: 'codigo-opaco-de-un-solo-uso' });

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      status: HttpStatusCodes.OK.code,
      message: HttpStatusCodes.OK.message,
      description: AuthMessages.google.exchange_success,
      path: EXCHANGE_PATH,
      data: sessionResult,
    });
    expect(response.body).not.toHaveProperty('meta');
  });

  it('pasa el codigo, el user_agent y la ip al service', async () => {
    exchangeGoogleCodeMock.mockResolvedValue(sessionResult);

    await request(buildApp())
      .post(EXCHANGE_PATH)
      .set('User-Agent', 'Mozilla/5.0 (Macintosh)')
      .send({ code: 'codigo-opaco-de-un-solo-uso' });

    expect(exchangeGoogleCodeMock).toHaveBeenCalledWith({
      code: 'codigo-opaco-de-un-solo-uso',
      user_agent: 'Mozilla/5.0 (Macintosh)',
      ip_address: expect.any(String),
    });
  });

  it('propaga el 400 TOKEN_INVALID del service cuando el codigo ya se uso o vencio', async () => {
    exchangeGoogleCodeMock.mockRejectedValue(
      new AppError(AuthMessages.google.code_invalid, HttpStatusCodes.BAD_REQUEST.code, {
        code: ErrorCodes.TOKEN_INVALID,
      }),
    );

    const response = await request(buildApp()).post(EXCHANGE_PATH).send({ code: 'ya-usado' });
    const envelope = readErrorEnvelope(response.body);

    expect(response.status).toBe(HttpStatusCodes.BAD_REQUEST.code);
    expect(envelope.meta).toEqual({ code: ErrorCodes.TOKEN_INVALID });
    expect(envelope.description).toBe(AuthMessages.google.code_invalid);
  });

  it.each([[{}], [{ code: '' }], [{ code: 42 }]])(
    'devuelve 422 VALIDATION_ERROR con el cuerpo %p y no llama al service',
    async (body) => {
      const response = await request(buildApp()).post(EXCHANGE_PATH).send(body);
      const envelope = readErrorEnvelope(response.body);

      expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
      expect(envelope.meta).toEqual({
        code: ErrorCodes.VALIDATION_ERROR,
        fields: { code: ValidationKeys.auth.code_required },
      });
      expect(exchangeGoogleCodeMock).not.toHaveBeenCalled();
    },
  );
});
