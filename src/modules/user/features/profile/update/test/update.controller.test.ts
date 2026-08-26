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

import { AuthHeaders } from '@/constants/auth';
import { ApiPrefix, MeRoutePrefix, UserEndpoints } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { UserMessages } from '@/constants/messages/user';
import { ValidationKeys } from '@/constants/validation_keys';
import { user_city } from '@/generated/enums';
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
  organization: 'Estudio Quispe & Rojas',
  is_independent: false,
  city: user_city.LIMA,
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

  it('un email en el cuerpo se ignora en silencio: 200 y el service no lo ve', async () => {
    const response = await patch(testBearer(), {
      ...BODY,
      email: 'otro@correo.test',
      role: 'ADMIN',
      id: 'usr_ajeno',
    });

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(updateProfileServiceMock).toHaveBeenCalledWith({
      user_id: TEST_USER_ID,
      full_name: BODY.full_name,
      organization: BODY.organization,
      is_independent: false,
      city: user_city.LIMA,
      city_other: undefined,
    });
  });

  it('city OTHER sin city_other responde 422 con la clave i18n del campo', async () => {
    const response = await patch(testBearer(), {
      ...BODY,
      city: user_city.OTHER,
    });

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(response.body).toMatchObject({
      meta: {
        code: ErrorCodes.VALIDATION_ERROR,
        fields: { city_other: ValidationKeys.auth.city_other_required },
      },
    });
    expect(updateProfileServiceMock).not.toHaveBeenCalled();
  });

  it('sin full_name responde 422 y no llega al service', async () => {
    const response = await patch(testBearer(), { city: user_city.LIMA });

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(response.body).toMatchObject({
      meta: { fields: { full_name: ValidationKeys.auth.full_name_required } },
    });
    expect(updateProfileServiceMock).not.toHaveBeenCalled();
  });

  it('is_independent ausente vale false, como en el registro', async () => {
    await patch(testBearer(), { full_name: BODY.full_name, city: user_city.LIMA });

    expect(updateProfileServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({ is_independent: false }),
    );
  });

  it('sin sesion responde 401 UNAUTHENTICATED', async () => {
    const response = await patch(undefined);

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(response.body).toMatchObject({ meta: { code: ErrorCodes.UNAUTHENTICATED } });
    expect(updateProfileServiceMock).not.toHaveBeenCalled();
  });
});
