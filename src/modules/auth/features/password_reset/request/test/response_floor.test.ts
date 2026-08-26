import { AuthPolicy } from '@/constants/auth';
import { waitForResponseFloor } from '@/modules/auth/features/password_reset/request/utils/response_floor';

const elapsedOf = async (started_at: number, minimum_ms: number): Promise<number> => {
  const before = Date.now();

  await waitForResponseFloor(started_at, minimum_ms);

  return Date.now() - before;
};

describe('waitForResponseFloor', () => {
  it('espera lo que falta hasta el suelo', async () => {
    expect(await elapsedOf(Date.now(), 120)).toBeGreaterThanOrEqual(100);
  });

  it('no espera nada si el trabajo ya paso el suelo', async () => {
    expect(await elapsedOf(Date.now() - 500, 120)).toBeLessThan(50);
  });

  it('toma el suelo por defecto de la politica de auth', () => {
    expect(AuthPolicy.password_forgot_min_response_ms).toBeGreaterThan(0);
  });
});
