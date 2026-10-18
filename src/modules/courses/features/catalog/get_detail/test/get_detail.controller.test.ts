import express, { type Express } from 'express';
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

jest.mock('@/modules/courses/shared/data/courses.repository', () => ({
  findPublishedCourseBySlug: jest.fn(),
  findPublishedLessonsByCourseId: jest.fn(),
}));

import { AuthHeaders } from '@/constants/auth';
import { ApiPrefix, CoursesRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CourseMessages } from '@/constants/messages/courses';
import { course_level, course_topic, lesson_type, user_role } from '@/generated/enums';
import { signSessionToken } from '@/infrastructure/jwt/sign_session_token';
import { registerErrorHandler } from '@/middlewares/error_handler';
import { getDetailRouter } from '@/modules/courses/features/catalog/get_detail/presentation/get_detail.routes';
import { findSessionById } from '@/modules/auth/shared/data/sessions.repository';
import type { SessionWithUser } from '@/modules/auth/shared/domain/session.types';
import {
  findPublishedCourseBySlug,
  findPublishedLessonsByCourseId,
} from '@/modules/courses/shared/data/courses.repository';
import type {
  CourseDetailRecord,
  LessonSummaryRecord,
} from '@/modules/courses/shared/domain/course.types';

const findSessionByIdMock = jest.mocked(findSessionById);
const findPublishedCourseBySlugMock = jest.mocked(findPublishedCourseBySlug);
const findPublishedLessonsByCourseIdMock = jest.mocked(findPublishedLessonsByCourseId);

const SLUG = 'fundamentos-de-legal-tech';
const path = `${ApiPrefix}${CoursesRoutePrefix}/${SLUG}`;

const NOW = new Date();

const COURSE: CourseDetailRecord = {
  teacher: null,
  id: 'crs_1',
  slug: SLUG,
  title: 'Fundamentos de legal tech',
  long_description: 'Seis lecciones para entender de qué hablan cuando hablan de legal tech.',
  topic: course_topic.FIRST_STEPS,
  level: course_level.INTRODUCTORY,
  cover_image_url: null,
  published_at: new Date('2026-06-01T12:00:00.000Z'),
};

const LESSONS: readonly LessonSummaryRecord[] = [
  {
    id: 'lesson-1',
    slug: 'que-es-legal-tech-y-que-no',
    title: 'Qué es legal tech y qué no',
    description: 'Separamos tres cosas que suelen ir revueltas.',
    type: lesson_type.VIDEO,
    position: 1,
    duration_seconds: 480,
    reading_minutes: null,
    is_free_sample: true,
  },
  {
    id: 'lesson-2',
    slug: 'el-costo-oculto-de-trabajar-en-word-y-correo',
    title: 'El costo oculto de trabajar en Word y correo',
    description: 'Cuánto tiempo se pierde buscando la última versión.',
    type: lesson_type.ARTICLE,
    position: 2,
    duration_seconds: null,
    reading_minutes: 2,
    is_free_sample: false,
  },
];

const liveSession = (): SessionWithUser => ({
  id: 'ses_1',
  user_id: 'usr_1',
  remember_me: true,
  created_at: NOW,
  expires_at: new Date(NOW.getTime() + 60 * 60 * 1000),
  last_used_at: NOW,
  revoked_at: null,
  user: {
    id: 'usr_1',
    email: 'maria@estudioqp.pe',
    role: user_role.STUDENT,
    email_verified_at: NOW,
  },
});

const tokenExpiringAt = (absolute_expires_at: Date): string =>
  signSessionToken({
    user_id: 'usr_1',
    session_id: 'ses_1',
    role: user_role.STUDENT,
    absolute_expires_at,
    issued_at: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
  });

const buildApp = (): Express => {
  const app = express();

  app.use(`${ApiPrefix}${CoursesRoutePrefix}`, getDetailRouter);
  registerErrorHandler(app);

  return app;
};

const call = (token?: string) => {
  const pending = request(buildApp()).get(path);

  return token === undefined
    ? pending
    : pending.set(AuthHeaders.authorization, `${AuthHeaders.bearer_prefix}${token}`);
};

beforeEach(() => {
  jest.clearAllMocks();
  findPublishedCourseBySlugMock.mockResolvedValue(COURSE);
  findPublishedLessonsByCourseIdMock.mockResolvedValue(LESSONS);
  findSessionByIdMock.mockResolvedValue(liveSession());
});

describe('GET /courses/:slug · sin sesión', () => {
  it('responde 200 con el sobre del contrato y el temario completo', async () => {
    const response = await call();

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      status: HttpStatusCodes.OK.code,
      description: CourseMessages.detail.success,
      path,
      data: {
        course: { slug: SLUG, lesson_count: 2, video_count: 1, article_count: 1 },
        lessons: [
          { position: 1, is_unlocked: true },
          { position: 2, is_unlocked: false },
        ],
      },
    });
  });

  it('el JSON serializado no lleva article_body, transcript ni el id del video', async () => {
    const response = await call();
    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toContain('article_body');
    expect(serialized).not.toContain('transcript');
    expect(serialized).not.toContain('video_provider');
    expect(serialized).not.toContain('video_external_id');
  });

  it('no filtra el id interno ni el estado del curso', async () => {
    const response = await call();
    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toContain('crs_1');
    expect(serialized).not.toContain('catalog_order');
  });

  it('un slug que no existe responde 404 NOT_FOUND', async () => {
    findPublishedCourseBySlugMock.mockResolvedValue(null);

    const response = await call();

    expect(response.status).toBe(HttpStatusCodes.NOT_FOUND.code);
    expect(response.body).toMatchObject({
      description: CourseMessages.course.not_found,
      meta: { code: ErrorCodes.NOT_FOUND },
    });
  });
});

describe('GET /courses/:slug · con Bearer', () => {
  it('con una sesión viva desbloquea todas las lecciones y sigue sin soltar el contenido', async () => {
    const response = await call(tokenExpiringAt(new Date(NOW.getTime() + 24 * 60 * 60 * 1000)));
    const serialized = JSON.stringify(response.body);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      data: {
        lessons: [
          { position: 1, is_unlocked: true },
          { position: 2, is_unlocked: true },
        ],
      },
    });
    expect(serialized).not.toContain('article_body');
    expect(serialized).not.toContain('transcript');
  });

  it('un Bearer caducado responde 200 como anónimo, no 401', async () => {
    const response = await call(tokenExpiringAt(new Date(NOW.getTime() - 60 * 60 * 1000)));

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      data: {
        lessons: [
          { position: 1, is_unlocked: true },
          { position: 2, is_unlocked: false },
        ],
      },
    });
  });

  it('un token de una sesión revocada no desbloquea nada', async () => {
    findSessionByIdMock.mockResolvedValue({ ...liveSession(), revoked_at: NOW });

    const response = await call(tokenExpiringAt(new Date(NOW.getTime() + 24 * 60 * 60 * 1000)));

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      data: {
        lessons: [
          { position: 1, is_unlocked: true },
          { position: 2, is_unlocked: false },
        ],
      },
    });
  });

  it('un Bearer con basura responde 200 como anónimo y ni siquiera consulta la sesión', async () => {
    const response = await call('esto-no-es-un-jwt');

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(findSessionByIdMock).not.toHaveBeenCalled();
  });
});
