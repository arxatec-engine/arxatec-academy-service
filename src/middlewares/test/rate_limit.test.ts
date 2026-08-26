import express, { type Express, type RequestHandler } from 'express';
import request from 'supertest';

import { AuthRateLimits } from '@/constants/auth';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { registerErrorHandler } from '@/middlewares/error_handler';
import { loginByAccountRateLimit, loginByIpRateLimit } from '@/middlewares/rate_limit';

const LOGIN_PATH = '/login';

const buildApp = (...limiters: RequestHandler[]): Express => {
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json());
  app.post(LOGIN_PATH, ...limiters, (_req, res) => {
    res.status(HttpStatusCodes.UNAUTHORIZED.code).json({ ok: false });
  });
  registerErrorHandler(app);

  return app;
};

const attempt = async (app: Express, ip: string, email: string) =>
  request(app)
    .post(LOGIN_PATH)
    .set('X-Forwarded-For', ip)
    .send({ email, password: 'unaClaveLarga' });

const attemptMany = async (
  app: Express,
  ip: string,
  emails: readonly string[],
): Promise<number[]> => {
  const statuses: number[] = [];

  for (const email of emails) {
    statuses.push((await attempt(app, ip, email)).status);
  }

  return statuses;
};

const emails = (count: number): readonly string[] =>
  Array.from({ length: count }, (_value, index) => `victima${String(index)}@arxatec.pe`);

describe('cadena de limitadores de /auth/login', () => {
  it('corta el barrido de contrasenas: muchos correos distintos desde una sola IP', async () => {
    const app = buildApp(loginByIpRateLimit, loginByAccountRateLimit);

    const statuses = await attemptMany(
      app,
      '203.0.113.1',
      emails(AuthRateLimits.login_by_ip.max + 1),
    );

    expect(statuses.slice(0, AuthRateLimits.login_by_ip.max)).not.toContain(
      HttpStatusCodes.TOO_MANY_REQUESTS.code,
    );
    expect(statuses.at(-1)).toBe(HttpStatusCodes.TOO_MANY_REQUESTS.code);
  });

  it('sigue frenando la fuerza bruta contra una sola cuenta antes que el tope por IP', async () => {
    const app = buildApp(loginByIpRateLimit, loginByAccountRateLimit);
    const email = 'maria@estudioqp.pe';

    const statuses = await attemptMany(
      app,
      '203.0.113.2',
      Array.from({ length: AuthRateLimits.login_by_account.max + 1 }, () => email),
    );

    expect(statuses.slice(0, AuthRateLimits.login_by_account.max)).not.toContain(
      HttpStatusCodes.TOO_MANY_REQUESTS.code,
    );
    expect(statuses.at(-1)).toBe(HttpStatusCodes.TOO_MANY_REQUESTS.code);
    expect(AuthRateLimits.login_by_account.max).toBeLessThan(AuthRateLimits.login_by_ip.max);
  });

  it('responde el 429 con el sobre del contrato y Retry-After', async () => {
    const app = buildApp(loginByAccountRateLimit);
    const email = 'maria@estudioqp.pe';

    await attemptMany(
      app,
      '203.0.113.3',
      Array.from({ length: AuthRateLimits.login_by_account.max }, () => email),
    );

    const response = await attempt(app, '203.0.113.3', email);

    expect(response.status).toBe(HttpStatusCodes.TOO_MANY_REQUESTS.code);
    expect(response.headers['retry-after']).toBe(
      String(AuthRateLimits.login_by_account.window_seconds),
    );
    expect(response.body).toMatchObject({
      status: HttpStatusCodes.TOO_MANY_REQUESTS.code,
      meta: {
        code: ErrorCodes.RATE_LIMITED,
        retry_after_seconds: AuthRateLimits.login_by_account.window_seconds,
      },
    });
  });
});
