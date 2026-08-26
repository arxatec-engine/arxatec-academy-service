import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CourseMessages } from '@/constants/messages/courses';
import { course_status, lesson_status } from '@/generated/enums';
import { requireCommentableLesson } from '@/modules/comments/shared/domain/commentable_lesson';
import { findLessonWithCourseById } from '@/modules/courses/shared/data/course_refs.repository';
import type { LessonWithCourseRecord } from '@/modules/courses/shared/domain/course_refs.types';
import { isAppError } from '@/utils/errors';

jest.mock('@/modules/courses/shared/data/course_refs.repository', () => ({
  findLessonWithCourseById: jest.fn(),
}));

const findLessonWithCourseByIdMock = jest.mocked(findLessonWithCourseById);

const lesson = (overrides: Partial<LessonWithCourseRecord> = {}): LessonWithCourseRecord => ({
  id: 'les_1',
  slug: 'que-es-legal-tech-y-que-no',
  title: 'Qué es legal tech y qué no',
  is_free_sample: true,
  status: lesson_status.PUBLISHED,
  course: {
    id: 'crs_1',
    slug: 'fundamentos-de-legal-tech',
    title: 'Fundamentos de legal tech',
    status: course_status.PUBLISHED,
  },
  ...overrides,
});

beforeEach(() => {
  findLessonWithCourseByIdMock.mockResolvedValue(lesson());
});

const expectNotFound = async (): Promise<void> => {
  await expect(requireCommentableLesson('les_1')).rejects.toMatchObject({
    statusCode: HttpStatusCodes.NOT_FOUND.code,
    meta: { code: ErrorCodes.NOT_FOUND },
  });
};

describe('requireCommentableLesson', () => {
  it('una lección publicada de un curso publicado devuelve su id', async () => {
    await expect(requireCommentableLesson('les_1')).resolves.toEqual({ id: 'les_1' });
  });

  it('una lección que no existe responde 404 NOT_FOUND', async () => {
    findLessonWithCourseByIdMock.mockResolvedValue(null);

    await expectNotFound();
  });

  it('una lección en borrador responde 404, no 403: no se confirma que exista', async () => {
    findLessonWithCourseByIdMock.mockResolvedValue(lesson({ status: lesson_status.DRAFT }));

    await expectNotFound();
  });

  it('una lección de un curso archivado responde 404', async () => {
    findLessonWithCourseByIdMock.mockResolvedValue(
      lesson({
        course: {
          id: 'crs_1',
          slug: 'fundamentos-de-legal-tech',
          title: 'Fundamentos de legal tech',
          status: course_status.ARCHIVED,
        },
      }),
    );

    await expectNotFound();
  });

  it('una lección que NO es muestra gratuita sí admite comentarios: el muro es de contenido', async () => {
    findLessonWithCourseByIdMock.mockResolvedValue(lesson({ is_free_sample: false }));

    await expect(requireCommentableLesson('les_1')).resolves.toEqual({ id: 'les_1' });
  });

  it('el mensaje del 404 es el de la lección, no uno inventado', async () => {
    findLessonWithCourseByIdMock.mockResolvedValue(null);

    expect.assertions(2);

    try {
      await requireCommentableLesson('les_1');
    } catch (error: unknown) {
      expect(isAppError(error)).toBe(true);

      if (isAppError(error)) {
        expect(error.message).toBe(CourseMessages.lesson.not_found);
      }
    }
  });
});
