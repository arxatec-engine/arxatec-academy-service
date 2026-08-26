import { course_status, lesson_status } from '@/generated/enums';
import {
  findLessonWithCourseById,
  findPublishedLessonRefsByCourseIds,
} from '@/modules/courses/shared/data/course_refs.repository';
import type {
  LessonRefRecord,
  LessonWithCourseRecord,
} from '@/modules/courses/shared/domain/course_refs.types';
import { uncompleteLessonService } from '@/modules/progress/features/lesson_progress/uncomplete/presentation/uncomplete.service';
import {
  findCompletedLessonIds,
  uncompleteLesson,
} from '@/modules/progress/shared/data/progress.repository';

jest.mock('@/modules/courses/shared/data/course_refs.repository', () => ({
  findLessonWithCourseById: jest.fn(),
  findPublishedLessonRefsByCourseIds: jest.fn(),
}));

jest.mock('@/modules/progress/shared/data/progress.repository', () => ({
  uncompleteLesson: jest.fn(),
  findCompletedLessonIds: jest.fn(),
}));

const findLessonWithCourseByIdMock = jest.mocked(findLessonWithCourseById);
const findPublishedLessonRefsByCourseIdsMock = jest.mocked(findPublishedLessonRefsByCourseIds);
const uncompleteLessonMock = jest.mocked(uncompleteLesson);
const findCompletedLessonIdsMock = jest.mocked(findCompletedLessonIds);

const lessonAt = (position: number): LessonRefRecord => ({
  id: `les_${String(position)}`,
  course_id: 'crs_1',
  slug: `leccion-${String(position)}`,
  title: `Lección ${String(position)}`,
  position,
});

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

const payload = { user_id: 'usr_1', lesson_id: 'les_3', has_session: true };

beforeEach(() => {
  findLessonWithCourseByIdMock.mockResolvedValue(LESSON);
  findPublishedLessonRefsByCourseIdsMock.mockResolvedValue([lessonAt(1), lessonAt(2), lessonAt(3)]);
  uncompleteLessonMock.mockResolvedValue({
    course_id: 'crs_1',
    started_at: new Date('2026-07-01T10:00:00.000Z'),
    completed_at: null,
    last_lesson_id: 'les_3',
  });
  findCompletedLessonIdsMock.mockResolvedValue(['les_1', 'les_2']);
});

describe('uncompleteLessonService', () => {
  it('desmarca la lección y el curso vuelve a estar en curso', async () => {
    const result = await uncompleteLessonService(payload);

    expect(uncompleteLessonMock).toHaveBeenCalledWith({
      user_id: 'usr_1',
      lesson_id: 'les_3',
      course_id: 'crs_1',
    });
    expect(result.mark).toMatchObject({
      lesson_id: 'les_3',
      completed_at: null,
      enrollment: {
        completed_at: null,
        completed_lessons: 2,
        lesson_count: 3,
        next_lesson: { slug: 'leccion-3' },
      },
    });
  });

  it('sin inscripción, devuelve la marca sin inscripción', async () => {
    uncompleteLessonMock.mockResolvedValue(null);

    const result = await uncompleteLessonService(payload);

    expect(result.mark.enrollment).toBeNull();
  });

  it('una lección bloqueada no llega a escribir', async () => {
    findLessonWithCourseByIdMock.mockResolvedValue({ ...LESSON, status: lesson_status.DRAFT });

    await expect(uncompleteLessonService(payload)).rejects.toBeDefined();
    expect(uncompleteLessonMock).not.toHaveBeenCalled();
  });
});
