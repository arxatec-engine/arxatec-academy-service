import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';

import { ApiPrefix, AuthEndpoints, AuthRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { ValidationKeys } from '@/constants/validation_keys';
import { registerErrorHandler } from '@/middlewares/error_handler';
import { parseEnvelope } from '@/modules/auth/features/email_verification/test/http_envelope';
import { verifyEmailRouter } from '@/modules/auth/features/email_verification/verify/presentation/verify.routes';
import { verifyEmailService } from '@/modules/auth/features/email_verification/verify/presentation/verify.service';
import { AppError } from '@/utils/errors';

jest.mock('@/middlewares/rate_limit', () => ({
  emailVerifyRateLimit: (_req: Request, _res: Response, next: NextFunction): void => {
    next();
  },
}));

jest.mock('@/modules/auth/features/email_verification/verify/presentation/verify.service', () => ({
  verifyEmailService: jest.fn(),
}));

const verifyEmailServiceMock = jest.mocked(verifyEmailService);

const VERIFY_PATH = `${ApiPrefix}${AuthRoutePrefix}${AuthEndpoints.email_verify}`;

const buildApp = (): Express => {
  const app = express();

  app.use(express.json());
  app.use(`${ApiPrefix}${AuthRoutePrefix}`, verifyEmailRouter);
  registerErrorHandler(app);

  return app;
};

describe('verifyEmailController', () => {
  it('responde 200 con el sobre del contrato cuando el token verifica el correo', async () => {
    verifyEmailServiceMock.mockResolvedValue({ already_verified: false });

    const response = await request(buildApp()).post(VERIFY_PATH).send({ token: 'un-token' });
    const envelope = parseEnvelope(response.body);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(envelope.status).toBe(HttpStatusCodes.OK.code);
    expect(envelope.message).toBe(HttpStatusCodes.OK.message);
    expect(envelope.description).toBe(AuthMessages.email_verification.verified);
    expect(envelope.path).toBe(VERIFY_PATH);
    expect(verifyEmailServiceMock).toHaveBeenCalledWith({ token: 'un-token' });
  });

  it('responde 200, no un error, cuando el correo ya estaba verificado', async () => {
    verifyEmailServiceMock.mockResolvedValue({ already_verified: true });

    const response = await request(buildApp()).post(VERIFY_PATH).send({ token: 'un-token' });
    const envelope = parseEnvelope(response.body);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(envelope.description).toBe(AuthMessages.email_verification.already_verified);
  });

  it('recorta el token antes de llamar al service', async () => {
    verifyEmailServiceMock.mockResolvedValue({ already_verified: false });

    await request(buildApp()).post(VERIFY_PATH).send({ token: '  un-token  ' });

    expect(verifyEmailServiceMock).toHaveBeenCalledWith({ token: 'un-token' });
  });

  it('propaga el 400 TOKEN_INVALID del service sin try/catch', async () => {
    verifyEmailServiceMock.mockRejectedValue(
      new AppError(
        AuthMessages.email_verification.token_invalid,
        HttpStatusCodes.BAD_REQUEST.code,
        { code: ErrorCodes.TOKEN_INVALID },
      ),
    );

    const response = await request(buildApp()).post(VERIFY_PATH).send({ token: 'caducado' });
    const envelope = parseEnvelope(response.body);

    expect(response.status).toBe(HttpStatusCodes.BAD_REQUEST.code);
    expect(envelope.meta).toEqual({ code: ErrorCodes.TOKEN_INVALID });
    expect(envelope.description).toBe(AuthMessages.email_verification.token_invalid);
  });

  it('devuelve 422 VALIDATION_ERROR con la clave i18n cuando falta el token', async () => {
    const response = await request(buildApp()).post(VERIFY_PATH).send({});
    const envelope = parseEnvelope(response.body);

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(envelope.meta).toEqual({
      code: ErrorCodes.VALIDATION_ERROR,
      fields: { token: ValidationKeys.auth.token_required },
    });
    expect(verifyEmailServiceMock).not.toHaveBeenCalled();
  });

  it('devuelve 422 cuando el token es una cadena vacia', async () => {
    const response = await request(buildApp()).post(VERIFY_PATH).send({ token: '   ' });

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(verifyEmailServiceMock).not.toHaveBeenCalled();
  });
});
