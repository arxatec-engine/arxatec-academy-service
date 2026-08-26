import { course_status, lesson_status } from '@/generated/enums';
import {
  findLessonWithCourseById,
  findPublishedLessonRefsByCourseIds,
} from '@/modules/courses/shared/data/course_refs.repository';
import type {
  LessonRefRecord,
  LessonWithCourseRecord,
} from '@/modules/courses/shared/domain/course_refs.types';
import { completeLessonService } from '@/modules/progress/features/lesson_progress/complete/presentation/complete.service';
import {
  completeLesson,
  findCompletedLessonIds,
} from '@/modules/progress/shared/data/progress.repository';

jest.mock('@/modules/courses/shared/data/course_refs.repository', () => ({
  findLessonWithCourseById: jest.fn(),
  findPublishedLessonRefsByCourseIds: jest.fn(),
}));

jest.mock('@/modules/progress/shared/data/progress.repository', () => ({
  completeLesson: jest.fn(),
  findCompletedLessonIds: jest.fn(),
}));

const findLessonWithCourseByIdMock = jest.mocked(findLessonWithCourseById);
const findPublishedLessonRefsByCourseIdsMock = jest.mocked(findPublishedLessonRefsByCourseIds);
const completeLessonMock = jest.mocked(completeLesson);
const findCompletedLessonIdsMock = jest.mocked(findCompletedLessonIds);

const lessonAt = (position: number): LessonRefRecord => ({
  id: `les_${String(position)}`,
  course_id: 'crs_1',
  slug: `leccion-${String(position)}`,
  title: `Lección ${String(position)}`,
  position,
});

const LESSONS: readonly LessonRefRecord[] = [lessonAt(1), lessonAt(2), lessonAt(3)];

const LESSON: LessonWithCourseRecord = {
  id: 'les_3',
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

const SEALED_AT = new Date('2026-07-03T00:00:00.000Z');
const STARTED_AT = new Date('2026-07-01T10:00:00.000Z');

const payload = { user_id: 'usr_1', lesson_id: 'les_3', has_session: true };

const completionOf = (course_completed_at: Date | null) => ({
  progress: {
    lesson_id: 'les_3',
    completed_at: SEALED_AT,
    last_position_seconds: 0,
    updated_at: SEALED_AT,
  },
  enrollment: {
    course_id: 'crs_1',
    started_at: STARTED_AT,
    completed_at: course_completed_at,
    last_lesson_id: 'les_3',
  },
});

beforeEach(() => {
  findLessonWithCourseByIdMock.mockResolvedValue(LESSON);
  findPublishedLessonRefsByCourseIdsMock.mockResolvedValue(LESSONS);
  completeLessonMock.mockResolvedValue(completionOf(null));
  findCompletedLessonIdsMock.mockResolvedValue(['les_3']);
});

describe('completeLessonService', () => {
  it('marca la lección con las lecciones publicadas de ese momento', async () => {
    await completeLessonService(payload);

    expect(completeLessonMock).toHaveBeenCalledWith({
      user_id: 'usr_1',
      lesson_id: 'les_3',
      course_id: 'crs_1',
      published_lesson_ids: ['les_1', 'les_2', 'les_3'],
      completed_at: expect.any(Date) as Date,
    });
  });

  it('devuelve la marca y la inscripción con el contador al día', async () => {
    const result = await completeLessonService(payload);

    expect(result.mark).toEqual({
      lesson_id: 'les_3',
      completed_at: SEALED_AT.toISOString(),
      enrollment: {
        course: { slug: LESSON.course.slug, title: LESSON.course.title },
        started_at: STARTED_AT.toISOString(),
        completed_at: null,
        completed_lessons: 1,
        lesson_count: 3,
        next_lesson: { slug: 'leccion-1', title: 'Lección 1' },
      },
    });
  });

  it('completar la última que faltaba devuelve el curso sellado y sin siguiente lección', async () => {
    completeLessonMock.mockResolvedValue(completionOf(SEALED_AT));
    findCompletedLessonIdsMock.mockResolvedValue(['les_1', 'les_2', 'les_3']);

    const result = await completeLessonService(payload);

    expect(result.mark.enrollment).toMatchObject({
      completed_at: SEALED_AT.toISOString(),
      completed_lessons: 3,
      lesson_count: 3,
      next_lesson: null,
    });
  });

  it('con una lección nueva publicada, el curso ya no está al día pero conserva su fecha', async () => {
    completeLessonMock.mockResolvedValue(completionOf(SEALED_AT));
    findPublishedLessonRefsByCourseIdsMock.mockResolvedValue([...LESSONS, lessonAt(4)]);
    findCompletedLessonIdsMock.mockResolvedValue(['les_1', 'les_2', 'les_3']);

    const result = await completeLessonService(payload);

    expect(result.mark.enrollment).toMatchObject({
      completed_at: SEALED_AT.toISOString(),
      completed_lessons: 3,
      lesson_count: 4,
      next_lesson: { slug: 'leccion-4' },
    });
  });
});
