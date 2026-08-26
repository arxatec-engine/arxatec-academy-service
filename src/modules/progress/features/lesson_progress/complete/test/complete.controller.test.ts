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

jest.mock('@/modules/courses/shared/data/course_refs.repository', () => ({
  findLessonWithCourseById: jest.fn(),
  findPublishedLessonRefsByCourseIds: jest.fn(),
}));

jest.mock('@/modules/progress/shared/data/progress.repository', () => ({
  completeLesson: jest.fn(),
  uncompleteLesson: jest.fn(),
  findCompletedLessonIds: jest.fn(),
}));

import { AuthHeaders } from '@/constants/auth';
import { ApiPrefix, LessonsRoutePrefix } from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { ProgressMessages } from '@/constants/messages/progress';
import { course_status, lesson_status } from '@/generated/enums';
import { findSessionById } from '@/modules/auth/shared/data/sessions.repository';
import {
  findLessonWithCourseById,
  findPublishedLessonRefsByCourseIds,
} from '@/modules/courses/shared/data/course_refs.repository';
import type {
  LessonRefRecord,
  LessonWithCourseRecord,
} from '@/modules/courses/shared/domain/course_refs.types';
import { lessonProgressRouter } from '@/modules/progress/features/lesson_progress';
import {
  completeLesson,
  findCompletedLessonIds,
  uncompleteLesson,
} from '@/modules/progress/shared/data/progress.repository';
import {
  buildProgressApp,
  testBearer,
  testSession,
} from '@/modules/progress/shared/test/progress_test_app';

const findSessionByIdMock = jest.mocked(findSessionById);
const findLessonWithCourseByIdMock = jest.mocked(findLessonWithCourseById);
const findPublishedLessonRefsByCourseIdsMock = jest.mocked(findPublishedLessonRefsByCourseIds);
const completeLessonMock = jest.mocked(completeLesson);
const uncompleteLessonMock = jest.mocked(uncompleteLesson);
const findCompletedLessonIdsMock = jest.mocked(findCompletedLessonIds);

const LESSON_ID = 'les_3';
const COMPLETE_PATH = `${ApiPrefix}${LessonsRoutePrefix}/${LESSON_ID}/complete`;
const SEALED_AT = new Date('2026-07-03T00:00:00.000Z');
const STARTED_AT = new Date('2026-07-01T10:00:00.000Z');

const lessonAt = (position: number): LessonRefRecord => ({
  id: `les_${String(position)}`,
  course_id: 'crs_1',
  slug: `leccion-${String(position)}`,
  title: `Lección ${String(position)}`,
  position,
});

const LESSON: LessonWithCourseRecord = {
  id: LESSON_ID,
  slug: 'leccion-3',
  title: 'Lección 3',
  is_free_sample: false,
  status: lesson_status.PUBLISHED,
  course: {
    id: 'crs_1',
    slug: 'fundamentos-de-legal-tech',
    title: 'Fundamentos de legal tech',
    status: course_status.PUBLISHED,
  },
};

const ENROLLMENT = {
  course_id: 'crs_1',
  started_at: STARTED_AT,
  completed_at: null,
  last_lesson_id: LESSON_ID,
};

const app = () => buildProgressApp(LessonsRoutePrefix, lessonProgressRouter);

beforeEach(() => {
  findSessionByIdMock.mockResolvedValue(testSession());
  findLessonWithCourseByIdMock.mockResolvedValue(LESSON);
  findPublishedLessonRefsByCourseIdsMock.mockResolvedValue([lessonAt(1), lessonAt(2), lessonAt(3)]);
  findCompletedLessonIdsMock.mockResolvedValue([LESSON_ID]);
  completeLessonMock.mockResolvedValue({
    progress: {
      lesson_id: LESSON_ID,
      completed_at: SEALED_AT,
      last_position_seconds: 0,
      updated_at: SEALED_AT,
    },
    enrollment: ENROLLMENT,
  });
  uncompleteLessonMock.mockResolvedValue(ENROLLMENT);
});

describe('POST /lessons/:lesson_id/complete', () => {
  it('responde 200 con la marca y la inscripción', async () => {
    const response = await request(app())
      .post(COMPLETE_PATH)
      .set(AuthHeaders.authorization, testBearer());

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      description: ProgressMessages.lesson_progress.completed,
      data: {
        mark: {
          lesson_id: LESSON_ID,
          completed_at: SEALED_AT.toISOString(),
          enrollment: { course: { slug: LESSON.course.slug }, completed_lessons: 1 },
        },
      },
    });
  });

  it('una lección de un curso archivado responde 403 LESSON_LOCKED', async () => {
    findLessonWithCourseByIdMock.mockResolvedValue({
      ...LESSON,
      course: { ...LESSON.course, status: course_status.ARCHIVED },
    });

    const response = await request(app())
      .post(COMPLETE_PATH)
      .set(AuthHeaders.authorization, testBearer());

    expect(response.status).toBe(HttpStatusCodes.FORBIDDEN.code);
    expect(response.body).toMatchObject({
      description: ProgressMessages.lesson_progress.locked,
      meta: { code: ErrorCodes.LESSON_LOCKED },
    });
    expect(completeLessonMock).not.toHaveBeenCalled();
  });

  it('una lección en borrador responde 403 LESSON_LOCKED y no escribe', async () => {
    findLessonWithCourseByIdMock.mockResolvedValue({ ...LESSON, status: lesson_status.DRAFT });

    const response = await request(app())
      .post(COMPLETE_PATH)
      .set(AuthHeaders.authorization, testBearer());

    expect(response.status).toBe(HttpStatusCodes.FORBIDDEN.code);
    expect(completeLessonMock).not.toHaveBeenCalled();
  });

  it('una lección inexistente responde 404 NOT_FOUND', async () => {
    findLessonWithCourseByIdMock.mockResolvedValue(null);

    const response = await request(app())
      .post(COMPLETE_PATH)
      .set(AuthHeaders.authorization, testBearer());

    expect(response.status).toBe(HttpStatusCodes.NOT_FOUND.code);
    expect(response.body).toMatchObject({ meta: { code: ErrorCodes.NOT_FOUND } });
  });

  it('sin Bearer responde 401 y no lee la lección', async () => {
    const response = await request(app()).post(COMPLETE_PATH);

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(findLessonWithCourseByIdMock).not.toHaveBeenCalled();
  });
});

describe('DELETE /lessons/:lesson_id/complete', () => {
  it('responde 200 con la marca vacía y la inscripción sin fecha de fin', async () => {
    findCompletedLessonIdsMock.mockResolvedValue([]);

    const response = await request(app())
      .delete(COMPLETE_PATH)
      .set(AuthHeaders.authorization, testBearer());

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({
      description: ProgressMessages.lesson_progress.uncompleted,
      data: {
        mark: {
          lesson_id: LESSON_ID,
          completed_at: null,
          enrollment: { completed_at: null, completed_lessons: 0 },
        },
      },
    });
  });

  it('desmarcar en un curso archivado también responde 403 LESSON_LOCKED', async () => {
    findLessonWithCourseByIdMock.mockResolvedValue({
      ...LESSON,
      course: { ...LESSON.course, status: course_status.ARCHIVED },
    });

    const response = await request(app())
      .delete(COMPLETE_PATH)
      .set(AuthHeaders.authorization, testBearer());

    expect(response.status).toBe(HttpStatusCodes.FORBIDDEN.code);
    expect(uncompleteLessonMock).not.toHaveBeenCalled();
  });

  it('sin inscripción previa, la marca vuelve sin inscripción y sin reventar', async () => {
    uncompleteLessonMock.mockResolvedValue(null);
    findCompletedLessonIdsMock.mockResolvedValue([]);

    const response = await request(app())
      .delete(COMPLETE_PATH)
      .set(AuthHeaders.authorization, testBearer());

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toMatchObject({ data: { mark: { enrollment: null } } });
  });
});
