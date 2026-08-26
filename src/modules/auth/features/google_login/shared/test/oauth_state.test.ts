import { AuthPolicy } from '@/constants/auth';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import {
  signOauthState,
  verifyOauthState,
} from '@/modules/auth/features/google_login/shared/domain/oauth_state';
import { isAppError, type AppError } from '@/utils/errors';

const NOW = new Date('2026-08-20T12:00:00.000Z');
const SECOND_MS = 1000;

const captureError = (run: () => unknown): AppError => {
  try {
    run();
  } catch (error) {
    if (isAppError(error)) {
      return error;
    }

    throw error;
  }

  throw new Error('Se esperaba un AppError y la llamada no lanzo');
};

const at = (offset_seconds: number): Date => new Date(NOW.getTime() + offset_seconds * SECOND_MS);

describe('signOauthState', () => {
  it('devuelve un state en dos partes separadas por un punto', () => {
    const signed = signOauthState({ redirect_to: '/curso/fundamentos', now: NOW });

    expect(signed.state.split('.')).toHaveLength(2);
  });

  it('devuelve el nonce aparte, para que el controller lo guarde en la cookie', () => {
    const signed = signOauthState({ redirect_to: '/curso/fundamentos', now: NOW });

    expect(signed.nonce.length).toBeGreaterThan(0);
    expect(signed.state).not.toContain(signed.nonce);
  });

  it('produce un state distinto en cada llamada aunque el destino sea el mismo', () => {
    const first = signOauthState({ redirect_to: '/curso/fundamentos', now: NOW });
    const second = signOauthState({ redirect_to: '/curso/fundamentos', now: NOW });

    expect(first.state).not.toBe(second.state);
    expect(first.nonce).not.toBe(second.nonce);
    expect(verifyOauthState({ state: first.state, nonce: first.nonce, now: NOW })).toBe(
      verifyOauthState({ state: second.state, nonce: second.nonce, now: NOW }),
    );
  });

  it.each([
    ['https://malo.pe/phishing'],
    ['//malo.pe'],
    ['/curso\\malo'],
    ['sin-barra-inicial'],
    [''],
    [`/${'x'.repeat(AuthPolicy.redirect_to_max_length)}`],
  ])('rechaza el destino %p con 422 VALIDATION_ERROR antes de firmar nada', (redirect_to) => {
    const error = captureError(() => signOauthState({ redirect_to, now: NOW }));

    expect(error.statusCode).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(error.meta).toEqual({ code: ErrorCodes.VALIDATION_ERROR });
  });
});

describe('verifyOauthState', () => {
  const sign = (redirect_to: string, now: Date = NOW) => signOauthState({ redirect_to, now });

  it('devuelve el mismo destino que se firmo', () => {
    const signed = sign('/curso/fundamentos/leccion-3');

    expect(verifyOauthState({ state: signed.state, nonce: signed.nonce, now: NOW })).toBe(
      '/curso/fundamentos/leccion-3',
    );
  });

  it('acepta un state en el limite exacto de edad', () => {
    const signed = sign('/curso/fundamentos');

    expect(
      verifyOauthState({
        state: signed.state,
        nonce: signed.nonce,
        now: at(AuthPolicy.oauth_state_max_age_seconds),
      }),
    ).toBe('/curso/fundamentos');
  });

  it('rechaza un state vencido', () => {
    const signed = sign('/curso/fundamentos');

    const error = captureError(() =>
      verifyOauthState({
        state: signed.state,
        nonce: signed.nonce,
        now: at(AuthPolicy.oauth_state_max_age_seconds + 1),
      }),
    );

    expect(error.statusCode).toBe(HttpStatusCodes.BAD_REQUEST.code);
    expect(error.meta).toEqual({ code: ErrorCodes.TOKEN_INVALID });
  });

  it('rechaza un state emitido en el futuro', () => {
    const signed = sign('/curso/fundamentos');

    expect(() =>
      verifyOauthState({ state: signed.state, nonce: signed.nonce, now: at(-1) }),
    ).toThrow();
  });

  it('rechaza el state de otro navegador: el nonce de la cookie no es el del payload', () => {
    const victim = sign('/curso/fundamentos');
    const attacker = sign('/curso/fundamentos');

    const error = captureError(() =>
      verifyOauthState({ state: attacker.state, nonce: victim.nonce, now: NOW }),
    );

    expect(error.statusCode).toBe(HttpStatusCodes.BAD_REQUEST.code);
    expect(error.meta).toEqual({ code: ErrorCodes.TOKEN_INVALID });
  });

  it('rechaza un state sin cookie: el nonce vacio nunca vale', () => {
    const signed = sign('/curso/fundamentos');

    const error = captureError(() =>
      verifyOauthState({ state: signed.state, nonce: '', now: NOW }),
    );

    expect(error.statusCode).toBe(HttpStatusCodes.BAD_REQUEST.code);
    expect(error.meta).toEqual({ code: ErrorCodes.TOKEN_INVALID });
  });

  it('rechaza un payload manipulado aunque conserve la firma original', () => {
    const signed = sign('/curso/fundamentos');
    const [payload, signature] = signed.state.split('.');
    const forged_payload = Buffer.from(
      JSON.stringify({ redirect_to: 'https://malo.pe', nonce: signed.nonce, issued_at: 1 }),
      'utf8',
    ).toString('base64url');

    expect(forged_payload).not.toBe(payload);

    const error = captureError(() =>
      verifyOauthState({
        state: `${forged_payload}.${signature}`,
        nonce: signed.nonce,
        now: NOW,
      }),
    );

    expect(error.statusCode).toBe(HttpStatusCodes.BAD_REQUEST.code);
    expect(error.meta).toEqual({ code: ErrorCodes.TOKEN_INVALID });
  });

  it('rechaza una firma cambiada', () => {
    const signed = sign('/curso/fundamentos');
    const [payload] = signed.state.split('.');

    expect(() =>
      verifyOauthState({ state: `${payload}.firmaInventada`, nonce: signed.nonce, now: NOW }),
    ).toThrow();
  });

  it.each([
    ['', 'vacio'],
    ['sin-separador', 'sin separador'],
    ['.solo-firma', 'sin payload'],
    ['solo-payload.', 'sin firma'],
    ['a.b.c', 'con tres partes'],
  ])('rechaza el state %p (%s)', (state) => {
    const error = captureError(() => verifyOauthState({ state, nonce: 'un-nonce', now: NOW }));

    expect(error.statusCode).toBe(HttpStatusCodes.BAD_REQUEST.code);
    expect(error.meta).toEqual({ code: ErrorCodes.TOKEN_INVALID });
  });

  it.each([[undefined], [null], [42], [{ redirect_to: '/curso' }]])(
    'rechaza el state que no es una cadena (%p)',
    (state) => {
      expect(() => verifyOauthState({ state, nonce: 'un-nonce', now: NOW })).toThrow();
    },
  );
});
