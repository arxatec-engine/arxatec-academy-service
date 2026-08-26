import { FrontendRoutes } from '@/constants/endpoints';
import { verifyOauthState } from '@/modules/auth/features/google_login/shared/domain/oauth_state';
import { startGoogleLogin } from '@/modules/auth/features/google_login/start/presentation/start.service';

describe('startGoogleLogin', () => {
  it('firma el destino recibido y lo devuelve intacto dentro del state', () => {
    const result = startGoogleLogin({ redirect_to: '/curso/fundamentos/leccion-3' });

    expect(result.redirect_to).toBe('/curso/fundamentos/leccion-3');
    expect(verifyOauthState({ state: result.state, nonce: result.nonce })).toBe(
      '/curso/fundamentos/leccion-3',
    );
  });

  it('cae al inicio cuando la peticion no trae destino', () => {
    const result = startGoogleLogin({});

    expect(result.redirect_to).toBe(FrontendRoutes.home);
    expect(verifyOauthState({ state: result.state, nonce: result.nonce })).toBe(
      FrontendRoutes.home,
    );
  });

  it('nunca firma un destino externo: cae al inicio', () => {
    const result = startGoogleLogin({ redirect_to: 'https://malo.pe/phishing' });

    expect(result.redirect_to).toBe(FrontendRoutes.home);
    expect(verifyOauthState({ state: result.state, nonce: result.nonce })).toBe(
      FrontendRoutes.home,
    );
  });

  it('emite un state distinto en cada arranque', () => {
    const first = startGoogleLogin({ redirect_to: '/curso/fundamentos' });
    const second = startGoogleLogin({ redirect_to: '/curso/fundamentos' });

    expect(first.state).not.toBe(second.state);
    expect(first.nonce).not.toBe(second.nonce);
  });

  it('el nonce que devuelve es el unico que valida su state', () => {
    const first = startGoogleLogin({ redirect_to: '/curso/fundamentos' });
    const second = startGoogleLogin({ redirect_to: '/curso/fundamentos' });

    expect(() => verifyOauthState({ state: first.state, nonce: second.nonce })).toThrow();
  });
});
