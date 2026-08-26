import express, { type Express, type RequestHandler } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { redirectToGoogle } from '@/config/passport';
import { AuthCookies, AuthPolicy } from '@/constants/auth';
import { ApiPrefix, AuthEndpoints, AuthRoutePrefix, QueryParams } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { ValidationKeys } from '@/constants/validation_keys';
import { registerErrorHandler } from '@/middlewares/error_handler';
import { verifyOauthState } from '@/modules/auth/features/google_login/shared/domain/oauth_state';
import { googleStartController } from '@/modules/auth/features/google_login/start/presentation/start.controller';

jest.mock('@/config/passport', () => ({ redirectToGoogle: jest.fn() }));

const redirectToGoogleMock = jest.mocked(redirectToGoogle);

const START_PATH = `${ApiPrefix}${AuthRoutePrefix}${AuthEndpoints.google_start}`;
const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

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

const buildApp = (): Express => {
  const app = express();

  app.get(START_PATH, googleStartController);
  registerErrorHandler(app);

  return app;
};

const readSignedState = (): string => {
  const state: unknown = redirectToGoogleMock.mock.calls[0]?.[0];

  return z.string().parse(state);
};

const readSetCookie = (headers: unknown): string => {
  const cookies = z.object({ 'set-cookie': z.array(z.string()) }).parse(headers);
  const found = cookies['set-cookie'].find((cookie) =>
    cookie.startsWith(`${AuthCookies.oauth_state_nonce}=`),
  );

  return z.string().parse(found);
};

const readNonce = (headers: unknown): string =>
  decodeURIComponent(readSetCookie(headers).split(';')[0].split('=')[1]);

describe('googleStartController', () => {
  beforeEach(() => {
    redirectToGoogleMock.mockImplementation((state: string): RequestHandler => {
      const handler: RequestHandler = (_req, res) => {
        const link = new URL(GOOGLE_AUTHORIZE_URL);

        link.searchParams.set(QueryParams.state, state);
        res.redirect(HttpStatusCodes.FOUND.code, link.toString());
      };

      return handler;
    });
  });

  it('delega en passport y redirige a Google con el state firmado', async () => {
    const response = await request(buildApp())
      .get(START_PATH)
      .query({ [QueryParams.redirect_to]: '/curso/fundamentos' });

    expect(response.status).toBe(HttpStatusCodes.FOUND.code);
    expect(response.headers['location']).toContain(GOOGLE_AUTHORIZE_URL);
    expect(redirectToGoogleMock).toHaveBeenCalledTimes(1);
    expect(verifyOauthState({ state: readSignedState(), nonce: readNonce(response.headers) })).toBe(
      '/curso/fundamentos',
    );
  });

  it('ata el state al navegador con una cookie httpOnly de vida corta', async () => {
    const response = await request(buildApp()).get(START_PATH);
    const cookie = readSetCookie(response.headers);

    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain(`Path=${ApiPrefix}${AuthRoutePrefix}`);
    expect(cookie).toContain(`Max-Age=${AuthPolicy.oauth_state_max_age_seconds}`);
  });

  it('el state firmado no vale sin su cookie', () => {
    expect(() => verifyOauthState({ state: readSignedState(), nonce: '' })).toThrow();
  });

  it('firma el inicio cuando la peticion no trae redirect_to', async () => {
    const response = await request(buildApp()).get(START_PATH);

    expect(verifyOauthState({ state: readSignedState(), nonce: readNonce(response.headers) })).toBe(
      '/',
    );
  });

  it('nunca deja el destino en claro en la URL de Google: viaja dentro del state', async () => {
    const response = await request(buildApp())
      .get(START_PATH)
      .query({ [QueryParams.redirect_to]: '/curso/fundamentos' });
    const location = z.string().parse(response.headers['location']);

    expect(new URL(location).searchParams.get(QueryParams.redirect_to)).toBeNull();
  });

  it.each([['https://malo.pe/phishing'], ['//malo.pe'], ['sin-barra']])(
    'devuelve 422 VALIDATION_ERROR con el destino %p y no llama a passport',
    async (redirect_to) => {
      const response = await request(buildApp())
        .get(START_PATH)
        .query({ [QueryParams.redirect_to]: redirect_to });
      const envelope = readErrorEnvelope(response.body);

      expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
      expect(envelope.meta).toEqual({
        code: ErrorCodes.VALIDATION_ERROR,
        fields: { redirect_to: ValidationKeys.auth.redirect_to_invalid },
      });
      expect(redirectToGoogleMock).not.toHaveBeenCalled();
    },
  );

  it('propaga el fallo de passport cuando faltan las credenciales de Google', async () => {
    redirectToGoogleMock.mockImplementation((): RequestHandler => {
      throw new Error('GOOGLE_CLIENT_ID ausente');
    });

    const response = await request(buildApp()).get(START_PATH);
    const envelope = readErrorEnvelope(response.body);

    expect(response.status).toBe(HttpStatusCodes.INTERNAL_SERVER_ERROR.code);
    expect(envelope.meta.code).toBe(ErrorCodes.INTERNAL_ERROR);
  });
});
