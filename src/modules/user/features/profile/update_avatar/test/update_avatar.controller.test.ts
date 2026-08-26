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

jest.mock('@/modules/user/features/profile/update_avatar/presentation/update_avatar.service', () => ({
  updateAvatarService: jest.fn(),
}));

import { AuthHeaders } from '@/constants/auth';
import { ApiPrefix, MeRoutePrefix, UserEndpoints } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import {
  FileMaxSizeBytes,
  FileUploadField,
  FileUsages,
  MimeTypes,
} from '@/constants/files';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { FileMessages } from '@/constants/messages/files';
import { UserMessages } from '@/constants/messages/user';
import { ValidationKeys } from '@/constants/validation_keys';
import { findSessionById } from '@/modules/auth/shared/data/sessions.repository';
import { updateAvatarService } from '@/modules/user/features/profile/update_avatar/presentation/update_avatar.service';
import { updateAvatarRouter } from '@/modules/user/features/profile/update_avatar/presentation/update_avatar.routes';
import { apiUser } from '@/modules/user/shared/test/user_fixtures';
import {
  buildUserApp,
  testBearer,
  testSession,
  TEST_USER_ID,
} from '@/modules/user/shared/test/user_test_app';

const findSessionByIdMock = jest.mocked(findSessionById);
const updateAvatarServiceMock = jest.mocked(updateAvatarService);

const ROUTE = `${ApiPrefix}${MeRoutePrefix}${UserEndpoints.avatar}`;
const AVATAR_LIMIT = FileMaxSizeBytes[FileUsages.avatar];

const pngOf = (size: number): Buffer =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(size - 8, 0x41),
  ]);

const upload = (bearer: string, content: Buffer, contentType: string = MimeTypes.png) =>
  request(buildUserApp(updateAvatarRouter))
    .put(ROUTE)
    .set(AuthHeaders.authorization, bearer)
    .attach(FileUploadField, content, { filename: 'avatar.png', contentType });

beforeEach(() => {
  findSessionByIdMock.mockResolvedValue(testSession());
  updateAvatarServiceMock.mockResolvedValue({
    user: apiUser({ avatar_url: 'http://localhost:3001/files/avatars/nueva.png' }),
  });
});

describe('PUT /me/avatar', () => {
  it('responde 200 con el usuario y su foto nueva', async () => {
    const response = await upload(testBearer(), pngOf(1024));

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      description: UserMessages.avatar.updated,
      path: ROUTE,
      data: { user: { id: TEST_USER_ID } },
    });
  });

  it('el service recibe los bytes, el mime declarado y el tamano real', async () => {
    const content = pngOf(1024);

    await upload(testBearer(), content);

    expect(updateAvatarServiceMock).toHaveBeenCalledWith({
      user_id: TEST_USER_ID,
      mime_type: MimeTypes.png,
      size_bytes: content.byteLength,
      content,
    });
  });

  it(`${String(AVATAR_LIMIT)} bytes exactos pasan: la pantalla promete "hasta 2 MB"`, async () => {
    const response = await upload(testBearer(), pngOf(AVATAR_LIMIT));

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(updateAvatarServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({ size_bytes: AVATAR_LIMIT }),
    );
  });

  it('un byte mas responde 413 FILE_TOO_LARGE y el service no se llama', async () => {
    const response = await upload(testBearer(), pngOf(AVATAR_LIMIT + 1));

    expect(response.status).toBe(HttpStatusCodes.PAYLOAD_TOO_LARGE.code);
    expect(response.body).toMatchObject({
      description: FileMessages.too_large,
      meta: { code: ErrorCodes.FILE_TOO_LARGE },
    });
    expect(updateAvatarServiceMock).not.toHaveBeenCalled();
  });

  it('sin archivo responde 422 senalando el campo file', async () => {
    const response = await request(buildUserApp(updateAvatarRouter))
      .put(ROUTE)
      .set(AuthHeaders.authorization, testBearer());

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(response.body).toMatchObject({
      meta: {
        code: ErrorCodes.VALIDATION_ERROR,
        fields: { [FileUploadField]: ValidationKeys.user.avatar_required },
      },
    });
    expect(updateAvatarServiceMock).not.toHaveBeenCalled();
  });

  it('sin sesion responde 401 UNAUTHENTICATED', async () => {
    const response = await request(buildUserApp(updateAvatarRouter))
      .put(ROUTE)
      .attach(FileUploadField, pngOf(1024), { filename: 'avatar.png', contentType: MimeTypes.png });

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(updateAvatarServiceMock).not.toHaveBeenCalled();
  });
});
