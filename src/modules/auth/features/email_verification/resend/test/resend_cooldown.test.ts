import { AuthPolicy } from '@/constants/auth';
import { resolveResendCooldown } from '@/modules/auth/features/email_verification/resend/domain/resend_cooldown';

const NOW = new Date('2026-08-20T12:00:00.000Z');

const secondsBefore = (seconds: number): Date => new Date(NOW.getTime() - seconds * 1000);

describe('resolveResendCooldown', () => {
  it('permite el primer envio cuando el usuario no tiene ningun token previo', () => {
    expect(resolveResendCooldown({ last_sent_at: null, now: NOW })).toEqual({
      allowed: true,
      retry_after_seconds: AuthPolicy.resend_cooldown_seconds,
    });
  });

  it('bloquea dentro de los 45 s y devuelve los segundos que faltan', () => {
    expect(resolveResendCooldown({ last_sent_at: secondsBefore(10), now: NOW })).toEqual({
      allowed: false,
      retry_after_seconds: 35,
    });
  });

  it('permite justo a los 45 s cumplidos', () => {
    expect(
      resolveResendCooldown({
        last_sent_at: secondsBefore(AuthPolicy.resend_cooldown_seconds),
        now: NOW,
      }),
    ).toEqual({ allowed: true, retry_after_seconds: AuthPolicy.resend_cooldown_seconds });
  });

  it('bloquea un milisegundo antes de cumplirse el cooldown', () => {
    const last_sent_at = new Date(NOW.getTime() - AuthPolicy.resend_cooldown_seconds * 1000 + 1);

    expect(resolveResendCooldown({ last_sent_at, now: NOW })).toEqual({
      allowed: false,
      retry_after_seconds: 1,
    });
  });

  it('redondea hacia arriba: nunca promete menos espera de la que queda', () => {
    expect(
      resolveResendCooldown({ last_sent_at: new Date(NOW.getTime() - 10_500), now: NOW }),
    ).toEqual({ allowed: false, retry_after_seconds: 35 });
  });

  it('con un reloj desajustado no promete mas espera que el propio cooldown', () => {
    const last_sent_at = new Date(NOW.getTime() + 10 * 60 * 1000);

    expect(resolveResendCooldown({ last_sent_at, now: NOW })).toEqual({
      allowed: false,
      retry_after_seconds: AuthPolicy.resend_cooldown_seconds,
    });
  });

  it('no muta la fecha que recibe', () => {
    const last_sent_at = secondsBefore(10);

    resolveResendCooldown({ last_sent_at, now: NOW });

    expect(last_sent_at.toISOString()).toBe('2026-08-20T11:59:50.000Z');
  });
});
