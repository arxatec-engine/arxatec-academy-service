import express, { type Express } from 'express';
import supertest from 'supertest';

import { AuthEndpoints } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { ValidationKeys } from '@/constants/validation_keys';
import { registerErrorHandler } from '@/middlewares/error_handler';
import { requestPasswordResetController } from '@/modules/auth/features/password_reset/request/presentation/request.controller';
import { requestPasswordReset } from '@/modules/auth/features/password_reset/request/presentation/request.service';

jest.mock('@/config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@/modules/auth/features/password_reset/request/presentation/request.service', () => ({
  requestPasswordReset: jest.fn(),
}));

const service = jest.mocked(requestPasswordReset);

const readBody = (response: { body: unknown }): unknown => response.body;

const buildTestApp = (): Express => {
  const app = express();

  app.use(express.json());
  app.post(AuthEndpoints.password_forgot, requestPasswordResetController);
  registerErrorHandler(app);

  return app;
};

const post = async (body: object): Promise<supertest.Response> =>
  supertest(buildTestApp()).post(AuthEndpoints.password_forgot).send(body);

const OK_BODY = {
  status: HttpStatusCodes.OK.code,
  message: HttpStatusCodes.OK.message,
  description: AuthMessages.password_forgot.success,
  path: AuthEndpoints.password_forgot,
};

describe('requestPasswordResetController', () => {
  beforeEach(() => {
    service.mockResolvedValue(undefined);
  });

  it('responde 200 con el sobre del contrato para un correo existente', async () => {
    const response = await post({ email: 'maria@estudioqp.pe' });

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(readBody(response)).toMatchObject(OK_BODY);
  });

  it('responde exactamente lo mismo para un correo que no existe', async () => {
    const response = await post({ email: 'nadie@x.pe' });

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(readBody(response)).toMatchObject(OK_BODY);
  });

  it('no devuelve data ni meta: nada que permita deducir si la cuenta existe', async () => {
    const response = await post({ email: 'maria@estudioqp.pe' });

    expect(readBody(response)).not.toHaveProperty('data');
    expect(readBody(response)).not.toHaveProperty('meta');
  });

  it('entrega al service el correo ya normalizado', async () => {
    await post({ email: '  MaRia@EstudioQP.PE  ', redirect_to: '/curso/fundamentos' });

    expect(service).toHaveBeenCalledWith({
      email: 'maria@estudioqp.pe',
      redirect_to: '/curso/fundamentos',
    });
  });

  it('responde 422 VALIDATION_ERROR con la clave i18n del campo correo', async () => {
    const response = await post({ email: 'maria' });

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(readBody(response)).toMatchObject({
      meta: {
        code: ErrorCodes.VALIDATION_ERROR,
        fields: { email: ValidationKeys.auth.email_invalid },
      },
    });
    expect(service).not.toHaveBeenCalled();
  });

  it('responde 422 cuando el redirect_to no es un path relativo', async () => {
    const response = await post({ email: 'maria@estudioqp.pe', redirect_to: 'https://malo.pe' });

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(readBody(response)).toMatchObject({
      meta: {
        code: ErrorCodes.VALIDATION_ERROR,
        fields: { redirect_to: ValidationKeys.auth.redirect_to_invalid },
      },
    });
    expect(service).not.toHaveBeenCalled();
  });

  it('deja subir al manejador global el fallo del service, sin try/catch propio', async () => {
    service.mockRejectedValue(new Error('base caida'));

    const response = await post({ email: 'maria@estudioqp.pe' });

    expect(response.status).toBe(HttpStatusCodes.INTERNAL_SERVER_ERROR.code);
    expect(readBody(response)).toMatchObject({ meta: { code: ErrorCodes.INTERNAL_ERROR } });
  });
});
