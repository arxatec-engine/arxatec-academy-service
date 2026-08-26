import { AuthPolicy, AuthTokenTtlSeconds } from '@/constants/auth';
import {
  computeSessionAbsoluteExpiresAt,
  computeSessionExpiresAt,
  isSessionActive,
  isSessionExpired,
  isSessionRevoked,
  resolveSessionRenewal,
  resolveSessionTtlSeconds,
} from '@/modules/auth/shared/policy/session_policy';

const now = new Date('2026-08-20T12:00:00.000Z');
const created_at = new Date('2026-08-20T11:00:00.000Z');

describe('resolveSessionTtlSeconds', () => {
  it('da 30 dias cuando el usuario marco "mantener la sesion"', () => {
    expect(resolveSessionTtlSeconds(true)).toBe(AuthTokenTtlSeconds.session_remember_me);
    expect(resolveSessionTtlSeconds(true)).toBe(30 * 24 * 60 * 60);
  });

  it('da 12 horas cuando no lo marco', () => {
    expect(resolveSessionTtlSeconds(false)).toBe(AuthTokenTtlSeconds.session_short);
    expect(resolveSessionTtlSeconds(false)).toBe(12 * 60 * 60);
  });
});

describe('computeSessionExpiresAt', () => {
  it('suma 30 dias con remember_me', () => {
    expect(computeSessionExpiresAt({ remember_me: true, now }).toISOString()).toBe(
      '2026-09-19T12:00:00.000Z',
    );
  });

  it('suma 12 horas sin remember_me', () => {
    expect(computeSessionExpiresAt({ remember_me: false, now }).toISOString()).toBe(
      '2026-08-21T00:00:00.000Z',
    );
  });

  it('no muta la fecha que recibe', () => {
    const reference = new Date(now.getTime());

    computeSessionExpiresAt({ remember_me: true, now: reference });

    expect(reference.toISOString()).toBe(now.toISOString());
  });
});

describe('computeSessionAbsoluteExpiresAt', () => {
  it('suma el tope absoluto a la fecha de creacion de la sesion', () => {
    expect(computeSessionAbsoluteExpiresAt(created_at).getTime()).toBe(
      created_at.getTime() + AuthTokenTtlSeconds.session_absolute_max * 1000,
    );
  });

  it('es el mismo instante que el exp del JWT: 180 dias', () => {
    expect(AuthTokenTtlSeconds.session_absolute_max).toBe(180 * 24 * 60 * 60);
  });
});

describe('isSessionRevoked / isSessionExpired / isSessionActive', () => {
  const expires_at = new Date('2026-08-21T12:00:00.000Z');

  it('una sesion vigente y sin revocar esta activa', () => {
    expect(isSessionActive({ expires_at, revoked_at: null, now })).toBe(true);
  });

  it('una sesion revocada no esta activa', () => {
    const revoked_at = new Date('2026-08-20T11:00:00.000Z');

    expect(isSessionRevoked({ expires_at, revoked_at, now })).toBe(true);
    expect(isSessionActive({ expires_at, revoked_at, now })).toBe(false);
  });

  it('vence en el instante exacto de expires_at, no un milisegundo despues', () => {
    expect(isSessionExpired({ expires_at: now, revoked_at: null, now })).toBe(true);
    expect(
      isSessionExpired({ expires_at: new Date(now.getTime() + 1), revoked_at: null, now }),
    ).toBe(false);
  });
});

describe('resolveSessionRenewal', () => {
  it('no escribe si la sesion se uso hace menos de 5 minutos', () => {
    const last_used_at = new Date(
      now.getTime() - (AuthPolicy.session_sliding_renewal_seconds - 1) * 1000,
    );

    expect(
      resolveSessionRenewal({ remember_me: true, created_at, last_used_at, now }).should_renew,
    ).toBe(false);
  });

  it('escribe justo al cumplirse los 5 minutos', () => {
    const last_used_at = new Date(
      now.getTime() - AuthPolicy.session_sliding_renewal_seconds * 1000,
    );

    expect(
      resolveSessionRenewal({ remember_me: true, created_at, last_used_at, now }).should_renew,
    ).toBe(true);
  });

  it('empuja expires_at con el ttl del tipo de sesion', () => {
    const last_used_at = new Date(now.getTime() - 10 * 60 * 1000);

    const renewal = resolveSessionRenewal({ remember_me: false, created_at, last_used_at, now });

    expect(renewal.last_used_at.toISOString()).toBe(now.toISOString());
    expect(renewal.expires_at.toISOString()).toBe('2026-08-21T00:00:00.000Z');
  });

  it('nunca empuja expires_at mas alla del tope absoluto de la sesion', () => {
    const old_created_at = new Date(
      now.getTime() - (AuthTokenTtlSeconds.session_absolute_max - 60 * 60) * 1000,
    );
    const last_used_at = new Date(now.getTime() - 10 * 60 * 1000);

    const renewal = resolveSessionRenewal({
      remember_me: true,
      created_at: old_created_at,
      last_used_at,
      now,
    });

    expect(renewal.expires_at.toISOString()).toBe(
      computeSessionAbsoluteExpiresAt(old_created_at).toISOString(),
    );
    expect(renewal.expires_at.getTime()).toBe(now.getTime() + 60 * 60 * 1000);
  });

  it('no renueva si last_used_at viene del futuro (reloj desajustado)', () => {
    const last_used_at = new Date(now.getTime() + 60 * 1000);

    expect(
      resolveSessionRenewal({ remember_me: true, created_at, last_used_at, now }).should_renew,
    ).toBe(false);
  });
});
