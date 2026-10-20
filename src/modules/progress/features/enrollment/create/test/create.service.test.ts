import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CourseMessages } from '@/constants/messages/courses';
import { course_level, course_topic } from '@/generated/enums';
import { findPublishedLessonRefsByCourseIds } from '@/modules/courses/shared/data/course_refs.repository';
import { findPublishedCourseBySlug } from '@/modules/courses/shared/data/courses.repository';
import type { CourseDetailRecord } from '@/modules/courses/shared/domain/course.types';
import type { LessonRefRecord } from '@/modules/courses/shared/domain/course_refs.types';
import { createEnrollmentService } from '@/modules/progress/features/enrollment/create/presentation/create.service';
import {
  enrollInCourse,
  findCompletedLessonIds,
} from '@/modules/progress/shared/data/progress.repository';
import type { EnrollmentRecord } from '@/modules/progress/shared/domain/progress.types';
import { isAppError } from '@/utils/errors';

jest.mock('@/modules/courses/shared/data/courses.repository', () => ({
  findPublishedCourseBySlug: jest.fn(),
}));

jest.mock('@/modules/courses/shared/data/course_refs.repository', () => ({
  findPublishedLessonRefsByCourseIds: jest.fn(),
}));

jest.mock('@/modules/progress/shared/data/progress.repository', () => ({
  enrollInCourse: jest.fn(),
  findCompletedLessonIds: jest.fn(),
}));

const findPublishedCourseBySlugMock = jest.mocked(findPublishedCourseBySlug);
const findPublishedLessonRefsByCourseIdsMock = jest.mocked(findPublishedLessonRefsByCourseIds);
const enrollInCourseMock = jest.mocked(enrollInCourse);
const findCompletedLessonIdsMock = jest.mocked(findCompletedLessonIds);

const COURSE: CourseDetailRecord = {
  teacher: null,
  id: 'crs_1',
  slug: 'fundamentos-de-legal-tech',
  title: 'Fundamentos de legal tech',
  long_description: 'Seis lecciones para entender de qué hablan cuando hablan de legal tech.',
  topic: course_topic.FIRST_STEPS,
  level: course_level.INTRODUCTORY,
  cover_image_key: null, cover_image_url: null,
  published_at: new Date('2026-06-01T12:00:00.000Z'),
};

const lessonAt = (position: number): LessonRefRecord => ({
  id: `les_${String(position)}`,
  course_id: COURSE.id,
  slug: `leccion-${String(position)}`,
  title: `Lección ${String(position)}`,
  position,
});

const LESSONS: readonly LessonRefRecord[] = [lessonAt(1), lessonAt(2), lessonAt(3)];

const ENROLLMENT: EnrollmentRecord = {
  course_id: COURSE.id,
  started_at: new Date('2026-07-01T10:00:00.000Z'),
  completed_at: null,
  last_lesson_id: null,
};

const payload = { user_id: 'usr_1', slug: COURSE.slug };

beforeEach(() => {
  findPublishedCourseBySlugMock.mockResolvedValue(COURSE);
  findPublishedLessonRefsByCourseIdsMock.mockResolvedValue(LESSONS);
  enrollInCourseMock.mockResolvedValue(ENROLLMENT);
  findCompletedLessonIdsMock.mockResolvedValue([]);
});

describe('createEnrollmentService', () => {
  it('empezar un curso devuelve la inscripción con la primera lección', async () => {
    const result = await createEnrollmentService(payload);

    expect(result.enrollment).toEqual({
      certificate_id: null,
      course: { slug: COURSE.slug, title: COURSE.title },
      started_at: '2026-07-01T10:00:00.000Z',
      completed_at: null,
      completed_lessons: 0,
      lesson_count: 3,
      next_lesson: { slug: 'leccion-1', title: 'Lección 1' },
    });
  });

  it('con progreso previo continúa por la primera NO completada', async () => {
    findCompletedLessonIdsMock.mockResolvedValue(['les_1', 'les_3']);

    const result = await createEnrollmentService(payload);

    expect(result.enrollment.next_lesson).toEqual({ slug: 'leccion-2', title: 'Lección 2' });
    expect(result.enrollment.completed_lessons).toBe(2);
  });

  it('inscribirse dos veces devuelve lo mismo: el repositorio es idempotente', async () => {
    const first = await createEnrollmentService(payload);
    const second = await createEnrollmentService(payload);

    expect(second).toEqual(first);
    expect(enrollInCourseMock).toHaveBeenCalledTimes(2);
    expect(enrollInCourseMock).toHaveBeenCalledWith({ user_id: 'usr_1', course_id: COURSE.id });
  });

  it('un curso en borrador, archivado o inexistente responde 404 NOT_FOUND', async () => {
    findPublishedCourseBySlugMock.mockResolvedValue(null);

    expect.assertions(3);

    try {
      await createEnrollmentService(payload);
    } catch (error: unknown) {
      expect(isAppError(error)).toBe(true);

      if (isAppError(error)) {
        expect(error.statusCode).toBe(HttpStatusCodes.NOT_FOUND.code);
        expect(error.message).toBe(CourseMessages.course.not_found);
      }
    }
  });

  it('no toca la inscripción si el curso no existe', async () => {
    findPublishedCourseBySlugMock.mockResolvedValue(null);

    await expect(createEnrollmentService(payload)).rejects.toMatchObject({
      meta: { code: ErrorCodes.NOT_FOUND },
    });
    expect(enrollInCourseMock).not.toHaveBeenCalled();
  });
});
