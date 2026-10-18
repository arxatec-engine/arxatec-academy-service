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

jest.mock('@/modules/user/features/profile/update/presentation/update.service', () => ({
  updateProfileService: jest.fn(),
}));

import { AuthHeaders, AuthPolicy } from '@/constants/auth';
import { ApiPrefix, MeRoutePrefix, UserEndpoints } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { UserMessages } from '@/constants/messages/user';
import { ValidationKeys } from '@/constants/validation_keys';
import { findSessionById } from '@/modules/auth/shared/data/sessions.repository';
import { updateProfileRouter } from '@/modules/user/features/profile/update/presentation/update.routes';
import { apiUser } from '@/modules/user/shared/test/user_fixtures';
import {
  buildUserApp,
  testBearer,
  testSession,
  TEST_USER_ID,
} from '@/modules/user/shared/test/user_test_app';
import { updateProfileService } from '@/modules/user/features/profile/update/presentation/update.service';

const findSessionByIdMock = jest.mocked(findSessionById);
const updateProfileServiceMock = jest.mocked(updateProfileService);

const ROUTE = `${ApiPrefix}${MeRoutePrefix}${UserEndpoints.profile}`;

const BODY = {
  full_name: 'Maria Quispe Rojas',
};

const patch = (bearer: string | undefined, body: Record<string, unknown> = BODY) => {
  const pending = request(buildUserApp(updateProfileRouter)).patch(ROUTE).send(body);

  return bearer === undefined ? pending : pending.set(AuthHeaders.authorization, bearer);
};

beforeEach(() => {
  findSessionByIdMock.mockResolvedValue(testSession());
  updateProfileServiceMock.mockResolvedValue({ user: apiUser() });
});

describe('PATCH /me/profile', () => {
  it('responde 200 con el usuario ya actualizado', async () => {
    const response = await patch(testBearer());

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      description: UserMessages.profile.updated,
      path: ROUTE,
      data: { user: { id: TEST_USER_ID } },
    });
  });

  it('ignora los campos retirados y usa el usuario de la sesión', async () => {
    const response = await patch(testBearer(), {
      ...BODY,
      email: 'otro@correo.test',
      role: 'ADMIN',
      id: 'usr_ajeno',
      user_id: 'usr_ajeno',
      organization: 'Estudio anterior',
      is_independent: true,
      city: 'OTHER',
      city_other: null,
    });

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(updateProfileServiceMock).toHaveBeenCalledWith({
      user_id: TEST_USER_ID,
      full_name: BODY.full_name,
    });
  });

  it.each([undefined, '', '   ', 'A'])(
    'rechaza un nombre ausente o inválido: %p',
    async (full_name) => {
      const response = await patch(testBearer(), { full_name });

      expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
      expect(response.body).toMatchObject({
        meta: { fields: { full_name: ValidationKeys.auth.full_name_required } },
      });
      expect(updateProfileServiceMock).not.toHaveBeenCalled();
    },
  );

  it('recorta los espacios del nombre antes de llamar al service', async () => {
    const response = await patch(testBearer(), { full_name: `  ${BODY.full_name}  ` });

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(updateProfileServiceMock).toHaveBeenCalledWith({
      user_id: TEST_USER_ID,
      full_name: BODY.full_name,
    });
  });

  it('rechaza un nombre que supera el máximo del registro', async () => {
    const response = await patch(testBearer(), {
      full_name: 'A'.repeat(AuthPolicy.full_name_max_length + 1),
    });

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(response.body).toMatchObject({
      meta: { fields: { full_name: ValidationKeys.auth.full_name_too_long } },
    });
    expect(updateProfileServiceMock).not.toHaveBeenCalled();
  });

  it('sin sesion responde 401 UNAUTHENTICATED', async () => {
    const response = await patch(undefined);

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(response.body).toMatchObject({ meta: { code: ErrorCodes.UNAUTHENTICATED } });
    expect(updateProfileServiceMock).not.toHaveBeenCalled();
  });
});
