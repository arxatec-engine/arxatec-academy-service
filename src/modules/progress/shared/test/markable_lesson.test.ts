import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CourseMessages } from '@/constants/messages/courses';
import { ProgressMessages } from '@/constants/messages/progress';
import { course_status, lesson_status } from '@/generated/enums';
import { findLessonWithCourseById } from '@/modules/courses/shared/data/course_refs.repository';
import type { LessonWithCourseRecord } from '@/modules/courses/shared/domain/course_refs.types';
import { requireMarkableLesson } from '@/modules/progress/shared/domain/markable_lesson';
import { isAppError, type AppError } from '@/utils/errors';

jest.mock('@/modules/courses/shared/data/course_refs.repository', () => ({
  findLessonWithCourseById: jest.fn(),
}));

const findLessonWithCourseByIdMock = jest.mocked(findLessonWithCourseById);

const LESSON: LessonWithCourseRecord = {
  id: 'les_3',
  slug: 'las-cuatro-herramientas-que-ya-usas-sin-saberlo',
  title: 'Las cuatro herramientas que ya usas sin saberlo',
  is_free_sample: false,
  status: lesson_status.PUBLISHED,
  course: {
    id: 'crs_1',
    slug: 'fundamentos-de-legal-tech',
    title: 'Fundamentos de legal tech',
    status: course_status.PUBLISHED,
  },
};

const captureError = async (lesson: LessonWithCourseRecord | null): Promise<AppError> => {
  findLessonWithCourseByIdMock.mockResolvedValue(lesson);

  try {
    await requireMarkableLesson({ lesson_id: 'les_3', has_session: true });
  } catch (error: unknown) {
    if (isAppError(error)) {
      return error;
    }
  }

  throw new Error('se esperaba un AppError');
};

beforeEach(() => {
  findLessonWithCourseByIdMock.mockResolvedValue(LESSON);
});

describe('requireMarkableLesson', () => {
  it('devuelve la lección y su curso cuando se puede marcar', async () => {
    await expect(requireMarkableLesson({ lesson_id: 'les_3', has_session: true })).resolves.toEqual({
      id: LESSON.id,
      course: LESSON.course,
    });
  });

  it('una lección que no existe es 404 NOT_FOUND, no 403', async () => {
    const error = await captureError(null);

    expect(error.statusCode).toBe(HttpStatusCodes.NOT_FOUND.code);
    expect(error.meta?.code).toBe(ErrorCodes.NOT_FOUND);
    expect(error.message).toBe(CourseMessages.lesson.not_found);
  });

  it('una lección en borrador es 403 LESSON_LOCKED', async () => {
    const error = await captureError({ ...LESSON, status: lesson_status.DRAFT });

    expect(error.statusCode).toBe(HttpStatusCodes.FORBIDDEN.code);
    expect(error.meta?.code).toBe(ErrorCodes.LESSON_LOCKED);
    expect(error.message).toBe(ProgressMessages.lesson_progress.locked);
  });

  it('una lección de un curso archivado es 403 LESSON_LOCKED', async () => {
    const error = await captureError({
      ...LESSON,
      course: { ...LESSON.course, status: course_status.ARCHIVED },
    });

    expect(error.statusCode).toBe(HttpStatusCodes.FORBIDDEN.code);
    expect(error.meta?.code).toBe(ErrorCodes.LESSON_LOCKED);
  });

  it('sin sesión, una lección normal es 403 LESSON_LOCKED', async () => {
    findLessonWithCourseByIdMock.mockResolvedValue(LESSON);

    await expect(
      requireMarkableLesson({ lesson_id: 'les_3', has_session: false }),
    ).rejects.toMatchObject({ statusCode: HttpStatusCodes.FORBIDDEN.code });
  });
});
