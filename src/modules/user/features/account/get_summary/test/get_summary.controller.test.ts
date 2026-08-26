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

jest.mock('@/modules/user/features/account/get_summary/presentation/get_summary.service', () => ({
  getSummaryService: jest.fn(),
}));

import { AuthHeaders } from '@/constants/auth';
import { ApiPrefix, MeRoutePrefix, UserEndpoints } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { UserMessages } from '@/constants/messages/user';
import { findSessionById } from '@/modules/auth/shared/data/sessions.repository';
import { getSummaryService } from '@/modules/user/features/account/get_summary/presentation/get_summary.service';
import { getSummaryRouter } from '@/modules/user/features/account/get_summary/presentation/get_summary.routes';
import {
  buildUserApp,
  testBearer,
  testSession,
  TEST_USER_ID,
} from '@/modules/user/shared/test/user_test_app';

const findSessionByIdMock = jest.mocked(findSessionById);
const getSummaryServiceMock = jest.mocked(getSummaryService);

const ROUTE = `${ApiPrefix}${MeRoutePrefix}${UserEndpoints.summary}`;

const SUMMARY = { member_since: '2026-05-12T10:00:00.000Z', completed_courses: 1 };

beforeEach(() => {
  findSessionByIdMock.mockResolvedValue(testSession());
  getSummaryServiceMock.mockResolvedValue(SUMMARY);
});

describe('GET /me/summary', () => {
  it('responde 200 con el pie de la pantalla 11', async () => {
    const response = await request(buildUserApp(getSummaryRouter))
      .get(ROUTE)
      .set(AuthHeaders.authorization, testBearer());

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      description: UserMessages.summary.success,
      path: ROUTE,
      data: SUMMARY,
    });
  });

  it('el service recibe el usuario de la sesion', async () => {
    await request(buildUserApp(getSummaryRouter))
      .get(ROUTE)
      .set(AuthHeaders.authorization, testBearer());

    expect(getSummaryServiceMock).toHaveBeenCalledWith({ user_id: TEST_USER_ID });
  });

  it('sin sesion responde 401 UNAUTHENTICATED', async () => {
    const response = await request(buildUserApp(getSummaryRouter)).get(ROUTE);

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(response.body).toMatchObject({ meta: { code: ErrorCodes.UNAUTHENTICATED } });
    expect(getSummaryServiceMock).not.toHaveBeenCalled();
  });
});
