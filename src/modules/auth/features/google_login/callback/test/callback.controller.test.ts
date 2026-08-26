import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { env } from '@/config/env';
import { AuthCookies } from '@/constants/auth';
import { resolveGoogleProfile } from '@/config/passport';
import {
  ApiPrefix,
  AuthEndpoints,
  AuthRoutePrefix,
  FrontendRoutes,
  QueryParams,
} from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { ValidationKeys } from '@/constants/validation_keys';
import { registerErrorHandler } from '@/middlewares/error_handler';
import { googleCallbackController } from '@/modules/auth/features/google_login/callback/presentation/callback.controller';
import { completeGoogleCallback } from '@/modules/auth/features/google_login/callback/presentation/callback.service';
import {
  signOauthState,
  type SignedOauthState,
} from '@/modules/auth/features/google_login/shared/domain/oauth_state';

jest.mock('@/config/passport', () => ({ resolveGoogleProfile: jest.fn() }));

jest.mock('@/modules/auth/features/google_login/callback/presentation/callback.service', () => ({
  completeGoogleCallback: jest.fn(),
}));

const resolveGoogleProfileMock = jest.mocked(resolveGoogleProfile);
const completeGoogleCallbackMock = jest.mocked(completeGoogleCallback);

const CALLBACK_PATH = `${ApiPrefix}${AuthRoutePrefix}${AuthEndpoints.google_callback}`;
const REDIRECT_TO = '/curso/fundamentos';
const EXCHANGE_CODE = 'codigo-opaco-de-un-solo-uso';

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

const googleProfile = {
  id: '110248495921238986420',
  displayName: 'Maria Quispe Rojas',
  emails: [{ value: '  Maria@EstudioQP.PE  ', verified: true }],
  photos: [{ value: 'https://lh3.googleusercontent.com/a/foto' }],
};

const buildApp = (): Express => {
  const app = express();

  app.use(cookieParser());
  app.get(CALLBACK_PATH, googleCallbackController);
  registerErrorHandler(app);

  return app;
};

const startedFlow = (redirect_to = REDIRECT_TO): SignedOauthState =>
  signOauthState({ redirect_to });

const callWith = async (signed: SignedOauthState, code = 'codigo-de-google') =>
  request(buildApp())
    .get(CALLBACK_PATH)
    .set('Cookie', [`${AuthCookies.oauth_state_nonce}=${signed.nonce}`])
    .query({ [QueryParams.code]: code, [QueryParams.state]: signed.state });

const readLocation = (location: unknown): URL => new URL(z.string().parse(location));

describe('googleCallbackController', () => {
  beforeEach(() => {
    resolveGoogleProfileMock.mockResolvedValue(googleProfile);
    completeGoogleCallbackMock.mockResolvedValue({
      code: EXCHANGE_CODE,
      redirect_to: REDIRECT_TO,
    });
  });

  it('redirige al frontend con el codigo de un solo uso y el destino de retorno', async () => {
    const response = await callWith(startedFlow());
    const location = readLocation(response.headers['location']);

    expect(response.status).toBe(HttpStatusCodes.FOUND.code);
    expect(location.origin).toBe(new URL(env.FRONTEND_URL).origin);
    expect(location.pathname).toBe(FrontendRoutes.oauth_callback);
    expect(location.searchParams.get(QueryParams.code)).toBe(EXCHANGE_CODE);
    expect(location.searchParams.get(QueryParams.redirect_to)).toBe(REDIRECT_TO);
  });

  it('nunca pone un token de sesion en la URL: solo viaja el codigo opaco', async () => {
    const response = await callWith(startedFlow());
    const location = readLocation(response.headers['location']);

    expect([...location.searchParams.keys()].sort()).toEqual([
      QueryParams.code,
      QueryParams.redirect_to,
    ]);
    expect(location.searchParams.get(QueryParams.token)).toBeNull();
  });

  it('normaliza el perfil de Google antes de pasarlo al service', async () => {
    await callWith(startedFlow());

    expect(completeGoogleCallbackMock).toHaveBeenCalledWith({
      profile: {
        provider_account_id: googleProfile.id,
        email: 'maria@estudioqp.pe',
        full_name: 'Maria Quispe Rojas',
        avatar_url: 'https://lh3.googleusercontent.com/a/foto',
        email_verified: true,
      },
      redirect_to: REDIRECT_TO,
    });
  });

  it('recupera el destino de retorno del state, no de la query', async () => {
    const signed = startedFlow('/curso/otro');

    const response = await request(buildApp())
      .get(CALLBACK_PATH)
      .set('Cookie', [`${AuthCookies.oauth_state_nonce}=${signed.nonce}`])
      .query({
        [QueryParams.code]: 'codigo-de-google',
        [QueryParams.state]: signed.state,
        [QueryParams.redirect_to]: 'https://malo.pe/phishing',
      });

    expect(response.status).toBe(HttpStatusCodes.FOUND.code);
    expect(completeGoogleCallbackMock).toHaveBeenCalledWith(
      expect.objectContaining({ redirect_to: '/curso/otro' }),
    );
  });

  it('rechaza un state manipulado con 400 TOKEN_INVALID y sin hablar con Google', async () => {
    const signed = startedFlow();

    const response = await callWith({ state: `${signed.state}x`, nonce: signed.nonce });
    const envelope = readErrorEnvelope(response.body);

    expect(response.status).toBe(HttpStatusCodes.BAD_REQUEST.code);
    expect(envelope.meta).toEqual({ code: ErrorCodes.TOKEN_INVALID });
    expect(resolveGoogleProfileMock).not.toHaveBeenCalled();
    expect(completeGoogleCallbackMock).not.toHaveBeenCalled();
  });

  it('devuelve 422 cuando Google vuelve sin code (el usuario cancelo el consentimiento)', async () => {
    const response = await request(buildApp())
      .get(CALLBACK_PATH)
      .query({ error: 'access_denied', [QueryParams.state]: startedFlow('/').state });
    const envelope = readErrorEnvelope(response.body);

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(envelope.meta).toEqual({
      code: ErrorCodes.VALIDATION_ERROR,
      fields: { code: ValidationKeys.auth.code_required },
    });
    expect(resolveGoogleProfileMock).not.toHaveBeenCalled();
  });

  it('rechaza el state de otro navegador con 400 TOKEN_INVALID y sin hablar con Google', async () => {
    const attacker = startedFlow();
    const victim = startedFlow();

    const response = await callWith({ state: attacker.state, nonce: victim.nonce });
    const envelope = readErrorEnvelope(response.body);

    expect(response.status).toBe(HttpStatusCodes.BAD_REQUEST.code);
    expect(envelope.meta).toEqual({ code: ErrorCodes.TOKEN_INVALID });
    expect(resolveGoogleProfileMock).not.toHaveBeenCalled();
    expect(completeGoogleCallbackMock).not.toHaveBeenCalled();
  });

  it('rechaza el callback que llega sin la cookie del inicio', async () => {
    const signed = startedFlow();

    const response = await request(buildApp())
      .get(CALLBACK_PATH)
      .query({ [QueryParams.code]: 'codigo-de-google', [QueryParams.state]: signed.state });
    const envelope = readErrorEnvelope(response.body);

    expect(response.status).toBe(HttpStatusCodes.BAD_REQUEST.code);
    expect(envelope.meta).toEqual({ code: ErrorCodes.TOKEN_INVALID });
    expect(resolveGoogleProfileMock).not.toHaveBeenCalled();
  });

  it('borra la cookie del state para que no valga dos veces', async () => {
    const response = await callWith(startedFlow());
    const cookies = z.array(z.string()).parse(response.headers['set-cookie']);

    expect(
      cookies.some(
        (cookie) =>
          cookie.startsWith(`${AuthCookies.oauth_state_nonce}=;`) &&
          cookie.includes('Expires=Thu, 01 Jan 1970'),
      ),
    ).toBe(true);
  });

  it('devuelve 400 TOKEN_INVALID cuando Google no comparte ningun correo', async () => {
    resolveGoogleProfileMock.mockResolvedValue({ id: '1', displayName: 'Sin correo' });

    const response = await callWith(startedFlow());
    const envelope = readErrorEnvelope(response.body);

    expect(response.status).toBe(HttpStatusCodes.BAD_REQUEST.code);
    expect(envelope.meta).toEqual({ code: ErrorCodes.TOKEN_INVALID });
    expect(completeGoogleCallbackMock).not.toHaveBeenCalled();
  });
});
