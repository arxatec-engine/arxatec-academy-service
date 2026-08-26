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

jest.mock('@/modules/user/features/account/delete/presentation/delete.service', () => ({
  deleteAccountService: jest.fn(),
}));

import { AuthHeaders } from '@/constants/auth';
import { ApiPrefix, MeRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { UserMessages } from '@/constants/messages/user';
import { findSessionById } from '@/modules/auth/shared/data/sessions.repository';
import { deleteAccountService } from '@/modules/user/features/account/delete/presentation/delete.service';
import { deleteAccountRouter } from '@/modules/user/features/account/delete/presentation/delete.routes';
import {
  buildUserApp,
  testBearer,
  testSession,
  TEST_USER_ID,
} from '@/modules/user/shared/test/user_test_app';
import { AppError } from '@/utils/errors';

const findSessionByIdMock = jest.mocked(findSessionById);
const deleteAccountServiceMock = jest.mocked(deleteAccountService);

const ROUTE = `${ApiPrefix}${MeRoutePrefix}`;

const del = (bearer: string | undefined, body: Record<string, unknown> = {}) => {
  const pending = request(buildUserApp(deleteAccountRouter)).delete(ROUTE).send(body);

  return bearer === undefined ? pending : pending.set(AuthHeaders.authorization, bearer);
};

beforeEach(() => {
  findSessionByIdMock.mockResolvedValue(testSession());
  deleteAccountServiceMock.mockResolvedValue(undefined);
});

describe('DELETE /me', () => {
  it('responde 204 sin cuerpo: no queda nada que describir', async () => {
    const response = await del(testBearer(), { password: 'claveActual' });

    expect(response.status).toBe(HttpStatusCodes.NO_CONTENT.code);
    expect(response.text).toBe('');
    expect(response.body).toEqual({});
  });

  it('el service recibe el usuario de la sesion y la contrasena del cuerpo', async () => {
    await del(testBearer(), { password: 'claveActual', user_id: 'usr_ajeno' });

    expect(deleteAccountServiceMock).toHaveBeenCalledWith({
      user_id: TEST_USER_ID,
      password: 'claveActual',
    });
  });

  it('sin contrasena llama al service igual: quien decide es la cuenta, no el schema', async () => {
    await del(testBearer());

    expect(deleteAccountServiceMock).toHaveBeenCalledWith({
      user_id: TEST_USER_ID,
      password: undefined,
    });
  });

  it('deja subir el 401 del service con su codigo', async () => {
    deleteAccountServiceMock.mockRejectedValue(
      new AppError(UserMessages.account.password_required, HttpStatusCodes.UNAUTHORIZED.code, {
        code: ErrorCodes.INVALID_CREDENTIALS,
      }),
    );

    const response = await del(testBearer());

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(response.body).toMatchObject({
      description: UserMessages.account.password_required,
      meta: { code: ErrorCodes.INVALID_CREDENTIALS },
    });
  });

  it('sin sesion responde 401 UNAUTHENTICATED', async () => {
    const response = await del(undefined);

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(response.body).toMatchObject({ meta: { code: ErrorCodes.UNAUTHENTICATED } });
    expect(deleteAccountServiceMock).not.toHaveBeenCalled();
  });
});
