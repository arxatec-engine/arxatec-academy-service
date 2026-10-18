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
  findPublishedLessonLocked: jest.fn(),
  findPublishedLessonUnlocked: jest.fn(),
}));

import { AuthHeaders } from '@/constants/auth';
import { ApiPrefix, CoursesRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CourseMessages } from '@/constants/messages/courses';
import {
  course_level,
  course_topic,
  lesson_type,
  user_role,
  video_provider,
} from '@/generated/enums';
import { signSessionToken } from '@/infrastructure/jwt/sign_session_token';
import { registerErrorHandler } from '@/middlewares/error_handler';
import { findSessionById } from '@/modules/auth/shared/data/sessions.repository';
import type { SessionWithUser } from '@/modules/auth/shared/domain/session.types';
import { getDetailRouter } from '@/modules/courses/features/lessons/get_detail/presentation/get_detail.routes';
import {
  findPublishedCourseBySlug,
  findPublishedLessonLocked,
  findPublishedLessonUnlocked,
  findPublishedLessonsByCourseId,
} from '@/modules/courses/shared/data/courses.repository';
import type {
  CourseDetailRecord,
  LessonSummaryRecord,
} from '@/modules/courses/shared/domain/course.types';
import type {
  LessonLockedRecord,
  LessonUnlockedRecord,
} from '@/modules/courses/shared/domain/lesson.types';

const findSessionByIdMock = jest.mocked(findSessionById);
const findPublishedCourseBySlugMock = jest.mocked(findPublishedCourseBySlug);
const findPublishedLessonsByCourseIdMock = jest.mocked(findPublishedLessonsByCourseId);
const findPublishedLessonLockedMock = jest.mocked(findPublishedLessonLocked);
const findPublishedLessonUnlockedMock = jest.mocked(findPublishedLessonUnlocked);

const COURSE_SLUG = 'fundamentos-de-legal-tech';
const SAMPLE_SLUG = 'que-es-legal-tech-y-que-no';
const VIDEO_SLUG = 'las-cuatro-herramientas-que-ya-usas-sin-saberlo';

const ARTICLE_BODY = '<p>Un estudio mediano pierde horas buscando la última versión.</p>';
const TRANSCRIPT = 'Firma digital, notificaciones electrónicas, expediente y plantillas.';
const VIDEO_EXTERNAL_ID = '901000003';

const pathTo = (lesson_slug: string): string =>
  `${ApiPrefix}${CoursesRoutePrefix}/${COURSE_SLUG}/lessons/${lesson_slug}`;

const NOW = new Date();

const COURSE: CourseDetailRecord = {
  teacher: null,
  id: 'crs_1',
  slug: COURSE_SLUG,
  title: 'Fundamentos de legal tech',
  long_description: 'Seis lecciones para entender de qué hablan cuando hablan de legal tech.',
  topic: course_topic.FIRST_STEPS,
  level: course_level.INTRODUCTORY,
  cover_image_url: null,
  published_at: new Date('2026-06-01T12:00:00.000Z'),
};

const TEMARIO: readonly LessonSummaryRecord[] = [
  {
    id: 'lesson-1',
    slug: SAMPLE_SLUG,
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
    slug: VIDEO_SLUG,
    title: 'Las cuatro herramientas que ya usas sin saberlo',
    description: 'Firma digital, notificaciones electrónicas y dos más.',
    type: lesson_type.VIDEO,
    position: 3,
    duration_seconds: 664,
    reading_minutes: null,
    is_free_sample: false,
  },
];

const LOCKED: LessonLockedRecord = {
  id: 'locked-lesson-id',
  slug: VIDEO_SLUG,
  title: 'Las cuatro herramientas que ya usas sin saberlo',
  description: 'Firma digital, notificaciones electrónicas y dos más.',
  type: lesson_type.VIDEO,
  position: 3,
  is_free_sample: false,
  duration_seconds: 664,
  reading_minutes: null,
};

const UNLOCKED: LessonUnlockedRecord = {
  ...LOCKED,
  video_provider: video_provider.VIMEO,
  video_external_id: VIDEO_EXTERNAL_ID,
  article_body: ARTICLE_BODY,
  transcript: TRANSCRIPT,
  updated_at: new Date('2026-06-12T00:00:00.000Z'),
  resources: [
    {
      title: 'Tabla comparativa de las cuatro herramientas',
      file_url: 'http://localhost:3010/files/lesson_resources/tabla.pdf',
      mime_type: 'application/pdf',
      size_bytes: 245760,
    },
  ],
};

const sessionOf = (email_verified_at: Date | null): SessionWithUser => ({
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
    email_verified_at,
  },
});

const liveToken = (): string =>
  signSessionToken({
    user_id: 'usr_1',
    session_id: 'ses_1',
    role: user_role.STUDENT,
    absolute_expires_at: new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
    issued_at: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
  });

const buildApp = (): Express => {
  const app = express();

  app.use(`${ApiPrefix}${CoursesRoutePrefix}`, getDetailRouter);
  registerErrorHandler(app);

  return app;
};

const call = (lesson_slug: string, token?: string) => {
  const pending = request(buildApp()).get(pathTo(lesson_slug));

  return token === undefined
    ? pending
    : pending.set(AuthHeaders.authorization, `${AuthHeaders.bearer_prefix}${token}`);
};

beforeEach(() => {
  jest.clearAllMocks();
  findPublishedCourseBySlugMock.mockResolvedValue(COURSE);
  findPublishedLessonsByCourseIdMock.mockResolvedValue(TEMARIO);
  findPublishedLessonLockedMock.mockResolvedValue(LOCKED);
  findPublishedLessonUnlockedMock.mockResolvedValue(UNLOCKED);
  findSessionByIdMock.mockResolvedValue(sessionOf(NOW));
});

describe('GET /courses/:course_slug/lessons/:lesson_slug · sin sesión', () => {
  it('la muestra gratuita responde 200 con la lección entera', async () => {
    findPublishedLessonUnlockedMock.mockResolvedValue({ ...UNLOCKED, slug: SAMPLE_SLUG });

    const response = await call(SAMPLE_SLUG);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      status: HttpStatusCodes.OK.code,
      description: CourseMessages.lesson.success,
      path: pathTo(SAMPLE_SLUG),
      data: {
        lesson: {
          slug: SAMPLE_SLUG,
          video: { provider: video_provider.VIMEO, external_id: VIDEO_EXTERNAL_ID },
          transcript: TRANSCRIPT,
        },
        course: { slug: COURSE_SLUG, lesson_count: 2 },
        navigation: { previous: null, next: { slug: VIDEO_SLUG } },
      },
    });
  });

  it('cualquier otra lección responde 403 LESSON_LOCKED', async () => {
    const response = await call(VIDEO_SLUG);

    expect(response.status).toBe(HttpStatusCodes.FORBIDDEN.code);
    expect(response.body).toMatchObject({
      status: HttpStatusCodes.FORBIDDEN.code,
      description: CourseMessages.lesson.locked,
      meta: { code: ErrorCodes.LESSON_LOCKED },
    });
  });

  it('el 403 trae el muro: título, descripción, tipo, duración y el temario', async () => {
    const response = await call(VIDEO_SLUG);

    expect(response.body).toMatchObject({
      data: {
        lesson: {
          slug: VIDEO_SLUG,
          title: LOCKED.title,
          description: LOCKED.description,
          type: lesson_type.VIDEO,
          duration_seconds: 664,
          is_free_sample: false,
        },
        course: { slug: COURSE_SLUG, title: COURSE.title, lesson_count: 2 },
        lessons: [
          { slug: SAMPLE_SLUG, is_unlocked: true },
          { slug: VIDEO_SLUG, is_unlocked: false },
        ],
      },
    });
  });

  it('en el JSON del 403 no aparece ni el cuerpo, ni la transcripción, ni el id del video', async () => {
    const response = await call(VIDEO_SLUG);
    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toContain(ARTICLE_BODY);
    expect(serialized).not.toContain(TRANSCRIPT);
    expect(serialized).not.toContain(VIDEO_EXTERNAL_ID);
    expect(serialized).not.toContain('article_body');
    expect(serialized).not.toContain('transcript');
    expect(serialized).not.toContain('external_id');
  });

  it('el 403 ni siquiera pide la forma abierta al repositorio', async () => {
    await call(VIDEO_SLUG);

    expect(findPublishedLessonUnlockedMock).not.toHaveBeenCalled();
  });

  it('un slug de lección que no existe responde 404 NOT_FOUND', async () => {
    const response = await call('esta-leccion-no-existe');

    expect(response.status).toBe(HttpStatusCodes.NOT_FOUND.code);
    expect(response.body).toMatchObject({
      description: CourseMessages.lesson.not_found,
      meta: { code: ErrorCodes.NOT_FOUND },
    });
  });

  it('un curso en borrador responde 404 NOT_FOUND, no 403', async () => {
    findPublishedCourseBySlugMock.mockResolvedValue(null);

    const response = await call(VIDEO_SLUG);

    expect(response.status).toBe(HttpStatusCodes.NOT_FOUND.code);
    expect(response.body).toMatchObject({
      description: CourseMessages.course.not_found,
      meta: { code: ErrorCodes.NOT_FOUND },
    });
  });
});

describe('GET /courses/:course_slug/lessons/:lesson_slug · con sesión', () => {
  it('con Bearer válido, una lección normal responde 200 con el contenido completo', async () => {
    const response = await call(VIDEO_SLUG, liveToken());

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      data: {
        lesson: {
          slug: VIDEO_SLUG,
          article_body: ARTICLE_BODY,
          transcript: TRANSCRIPT,
          video: { provider: video_provider.VIMEO, external_id: VIDEO_EXTERNAL_ID },
          resources: [{ title: 'Tabla comparativa de las cuatro herramientas' }],
          updated_at: '2026-06-12T00:00:00.000Z',
        },
      },
    });
  });

  it('con Bearer válido, la muestra gratuita sigue respondiendo 200', async () => {
    findPublishedLessonUnlockedMock.mockResolvedValue({ ...UNLOCKED, slug: SAMPLE_SLUG });

    const response = await call(SAMPLE_SLUG, liveToken());

    expect(response.status).toBe(HttpStatusCodes.OK.code);
  });

  it('un usuario SIN correo verificado ve la lección entera (D-006)', async () => {
    findSessionByIdMock.mockResolvedValue(sessionOf(null));

    const response = await call(VIDEO_SLUG, liveToken());

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      data: { lesson: { article_body: ARTICLE_BODY, transcript: TRANSCRIPT } },
    });
    expect(response.body).not.toMatchObject({ meta: { code: ErrorCodes.EMAIL_NOT_VERIFIED } });
  });

  it('un token de una sesión revocada vuelve a bloquear la lección', async () => {
    findSessionByIdMock.mockResolvedValue({ ...sessionOf(NOW), revoked_at: NOW });

    const response = await call(VIDEO_SLUG, liveToken());

    expect(response.status).toBe(HttpStatusCodes.FORBIDDEN.code);
    expect(response.body).toMatchObject({ meta: { code: ErrorCodes.LESSON_LOCKED } });
  });

  it('un Bearer con basura responde 403 como anónimo, no 401', async () => {
    const response = await call(VIDEO_SLUG, 'esto-no-es-un-jwt');

    expect(response.status).toBe(HttpStatusCodes.FORBIDDEN.code);
    expect(findSessionByIdMock).not.toHaveBeenCalled();
  });
});
