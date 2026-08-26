import request from 'supertest';

jest.mock('@/config/env', () => ({
  env: {
    JWT_SECRET: 'secreto-de-pruebas-con-mas-de-32-caracteres',
    JWT_ISSUER: 'arxatec-academy-test',
    LOG_LEVEL: 'silent',
  },
  isDevelopment: false,
  isProduction: false,
  isTest: true,
}));

jest.mock('@/modules/auth/shared/data/sessions.repository', () => ({
  findSessionById: jest.fn(),
  touchSession: jest.fn(),
}));

jest.mock(
  '@/modules/user/features/profile/update_password/presentation/update_password.service',
  () => ({ updatePasswordService: jest.fn() }),
);

import { AuthHeaders, AuthPolicy } from '@/constants/auth';
import { ApiPrefix, MeRoutePrefix, UserEndpoints } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { UserMessages } from '@/constants/messages/user';
import { ValidationKeys } from '@/constants/validation_keys';
import { findSessionById } from '@/modules/auth/shared/data/sessions.repository';
import { updatePasswordService } from '@/modules/user/features/profile/update_password/presentation/update_password.service';
import { updatePasswordRouter } from '@/modules/user/features/profile/update_password/presentation/update_password.routes';
import {
  buildUserApp,
  testBearer,
  testSession,
  TEST_SESSION_ID,
  TEST_USER_ID,
} from '@/modules/user/shared/test/user_test_app';

const findSessionByIdMock = jest.mocked(findSessionById);
const updatePasswordServiceMock = jest.mocked(updatePasswordService);

const ROUTE = `${ApiPrefix}${MeRoutePrefix}${UserEndpoints.password}`;

const BODY = { current_password: 'claveActual', new_password: 'claveNuevaLarga' };

const patch = (bearer: string | undefined, body: Record<string, unknown> = BODY) => {
  const pending = request(buildUserApp(updatePasswordRouter)).patch(ROUTE).send(body);

  return bearer === undefined ? pending : pending.set(AuthHeaders.authorization, bearer);
};

beforeEach(() => {
  findSessionByIdMock.mockResolvedValue(testSession());
  updatePasswordServiceMock.mockResolvedValue({ revoked_sessions: 1 });
});

describe('PATCH /me/password', () => {
  it('responde 200 con el sobre del contrato y sin data', async () => {
    const response = await patch(testBearer());

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      description: UserMessages.password.updated,
      path: ROUTE,
    });
    expect(response.body).not.toHaveProperty('data');
  });

  it('el service recibe el usuario y la sesion actual, que es la que se conserva', async () => {
    await patch(testBearer());

    expect(updatePasswordServiceMock).toHaveBeenCalledWith({
      user_id: TEST_USER_ID,
      session_id: TEST_SESSION_ID,
      current_password: BODY.current_password,
      new_password: BODY.new_password,
    });
  });

  it('la contrasena nueva igual que la actual responde 422 sin llegar al service', async () => {
    const response = await patch(testBearer(), {
      current_password: 'laMismaClave',
      new_password: 'laMismaClave',
    });

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(response.body).toMatchObject({
      meta: {
        code: ErrorCodes.VALIDATION_ERROR,
        fields: { new_password: ValidationKeys.user.password_same_as_current },
      },
    });
    expect(updatePasswordServiceMock).not.toHaveBeenCalled();
  });

  it('una contrasena nueva corta responde 422 con la clave del registro', async () => {
    const response = await patch(testBearer(), {
      current_password: 'claveActual',
      new_password: 'a'.repeat(AuthPolicy.password_min_length - 1),
    });

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(response.body).toMatchObject({
      meta: { fields: { new_password: ValidationKeys.auth.password_too_short } },
    });
  });

  it('sin la contrasena actual responde 422', async () => {
    const response = await patch(testBearer(), { new_password: 'claveNuevaLarga' });

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(response.body).toMatchObject({
      meta: { fields: { current_password: ValidationKeys.user.current_password_required } },
    });
    expect(updatePasswordServiceMock).not.toHaveBeenCalled();
  });

  it('sin sesion responde 401 UNAUTHENTICATED', async () => {
    const response = await patch(undefined);

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(response.body).toMatchObject({ meta: { code: ErrorCodes.UNAUTHENTICATED } });
    expect(updatePasswordServiceMock).not.toHaveBeenCalled();
  });
});
