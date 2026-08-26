import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';

import { AuthPolicy } from '@/constants/auth';
import { ApiPrefix, AuthEndpoints, AuthRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { user_role } from '@/generated/enums';
import { authenticateTokenJwt } from '@/middlewares/authenticate_token_jwt';
import { parseEnvelope } from '@/modules/auth/features/email_verification/test/http_envelope';
import { resendVerificationRouter } from '@/modules/auth/features/email_verification/resend/presentation/resend.routes';
import { resendVerificationService } from '@/modules/auth/features/email_verification/resend/presentation/resend.service';
import { registerErrorHandler } from '@/middlewares/error_handler';
import type { AuthenticatedUser } from '@/types/authenticated_user';
import { AppError } from '@/utils/errors';

jest.mock('@/middlewares/authenticate_token_jwt', () => ({ authenticateTokenJwt: jest.fn() }));

jest.mock('@/middlewares/rate_limit', () => ({
  emailResendRateLimit: (_req: Request, _res: Response, next: NextFunction): void => {
    next();
  },
}));

jest.mock('@/modules/auth/features/email_verification/resend/presentation/resend.service', () => ({
  resendVerificationService: jest.fn(),
}));

const authenticateTokenJwtMock = jest.mocked(authenticateTokenJwt);
const resendVerificationServiceMock = jest.mocked(resendVerificationService);

const RESEND_PATH = `${ApiPrefix}${AuthRoutePrefix}${AuthEndpoints.email_resend}`;

const sessionUser: AuthenticatedUser = {
  id: 'usr_1',
  email: 'maria@estudioqp.pe',
  role: user_role.STUDENT,
  session_id: 'ses_1',
  email_verified_at: null,
};

const buildApp = (): Express => {
  const app = express();

  app.use(express.json());
  app.use(`${ApiPrefix}${AuthRoutePrefix}`, resendVerificationRouter);
  registerErrorHandler(app);

  return app;
};

describe('resendVerificationController', () => {
  beforeEach(() => {
    authenticateTokenJwtMock.mockImplementation(
      (req: Request, _res: Response, next: NextFunction) => {
        req.user = sessionUser;
        next();

        return Promise.resolve();
      },
    );
  });

  it('responde 200 con retry_after_seconds para que la UI arranque su cuenta atras', async () => {
    resendVerificationServiceMock.mockResolvedValue({
      already_verified: false,
      retry_after_seconds: AuthPolicy.resend_cooldown_seconds,
    });

    const response = await request(buildApp()).post(RESEND_PATH).send();
    const envelope = parseEnvelope(response.body);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(envelope.description).toBe(AuthMessages.email_verification.resend_success);
    expect(envelope.path).toBe(RESEND_PATH);
    expect(envelope.data).toEqual({ retry_after_seconds: AuthPolicy.resend_cooldown_seconds });
  });

  it('pasa al service el usuario de la sesion, no un dato del cuerpo', async () => {
    resendVerificationServiceMock.mockResolvedValue({
      already_verified: false,
      retry_after_seconds: AuthPolicy.resend_cooldown_seconds,
    });

    await request(buildApp()).post(RESEND_PATH).send({ user_id: 'usr_intruso' });

    expect(resendVerificationServiceMock).toHaveBeenCalledWith({
      user_id: 'usr_1',
      email: 'maria@estudioqp.pe',
      email_verified_at: null,
    });
  });

  it('acepta una peticion sin cuerpo, que es como la manda la pantalla 07', async () => {
    resendVerificationServiceMock.mockResolvedValue({
      already_verified: false,
      retry_after_seconds: AuthPolicy.resend_cooldown_seconds,
    });

    const response = await request(buildApp()).post(RESEND_PATH);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(resendVerificationServiceMock).toHaveBeenCalledTimes(1);
  });

  it('propaga el 429 RESEND_COOLDOWN con meta.retry_after_seconds', async () => {
    resendVerificationServiceMock.mockRejectedValue(
      new AppError(
        AuthMessages.email_verification.resend_cooldown,
        HttpStatusCodes.TOO_MANY_REQUESTS.code,
        { code: ErrorCodes.RESEND_COOLDOWN, retry_after_seconds: 35 },
      ),
    );

    const response = await request(buildApp()).post(RESEND_PATH).send();
    const envelope = parseEnvelope(response.body);

    expect(response.status).toBe(HttpStatusCodes.TOO_MANY_REQUESTS.code);
    expect(envelope.meta).toEqual({
      code: ErrorCodes.RESEND_COOLDOWN,
      retry_after_seconds: 35,
    });
  });

  it('responde 200 sin reenviar nada si el correo ya estaba verificado', async () => {
    resendVerificationServiceMock.mockResolvedValue({
      already_verified: true,
      retry_after_seconds: 0,
    });

    const response = await request(buildApp()).post(RESEND_PATH).send();
    const envelope = parseEnvelope(response.body);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(envelope.description).toBe(AuthMessages.email_verification.already_verified);
    expect(envelope.data).toEqual({ retry_after_seconds: 0 });
  });

  it('devuelve 401 UNAUTHENTICATED y no llama al service si no hay usuario en la peticion', async () => {
    authenticateTokenJwtMock.mockImplementation(
      (_req: Request, _res: Response, next: NextFunction) => {
        next();

        return Promise.resolve();
      },
    );

    const response = await request(buildApp()).post(RESEND_PATH).send();
    const envelope = parseEnvelope(response.body);

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(envelope.meta).toEqual({ code: ErrorCodes.UNAUTHENTICATED });
    expect(resendVerificationServiceMock).not.toHaveBeenCalled();
  });

  it('monta el autenticador antes del controller en la cadena de la ruta', async () => {
    resendVerificationServiceMock.mockResolvedValue({
      already_verified: false,
      retry_after_seconds: AuthPolicy.resend_cooldown_seconds,
    });

    await request(buildApp()).post(RESEND_PATH).send();

    expect(authenticateTokenJwtMock).toHaveBeenCalledTimes(1);
    expect(resendVerificationServiceMock).toHaveBeenCalledTimes(1);
  });
});
