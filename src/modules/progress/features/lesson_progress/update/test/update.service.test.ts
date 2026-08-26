import { course_status, lesson_status } from '@/generated/enums';
import { findLessonWithCourseById } from '@/modules/courses/shared/data/course_refs.repository';
import { findPublishedLessonRefsByCourseIds } from '@/modules/courses/shared/data/course_refs.repository';
import type {
  LessonRefRecord,
  LessonWithCourseRecord,
} from '@/modules/courses/shared/domain/course_refs.types';
import { updateLessonProgressService } from '@/modules/progress/features/lesson_progress/update/presentation/update.service';
import {
  completeLesson,
  saveLessonProgress,
} from '@/modules/progress/shared/data/progress.repository';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { ErrorCodes } from '@/constants/error_codes';

jest.mock('@/modules/courses/shared/data/course_refs.repository', () => ({
  findLessonWithCourseById: jest.fn(),
  findPublishedLessonRefsByCourseIds: jest.fn(),
}));

jest.mock('@/modules/progress/shared/data/progress.repository', () => ({
  saveLessonProgress: jest.fn(),
  completeLesson: jest.fn(),
}));

const findLessonWithCourseByIdMock = jest.mocked(findLessonWithCourseById);
const findPublishedLessonRefsByCourseIdsMock = jest.mocked(findPublishedLessonRefsByCourseIds);
const saveLessonProgressMock = jest.mocked(saveLessonProgress);
const completeLessonMock = jest.mocked(completeLesson);

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

const lessonAt = (position: number): LessonRefRecord => ({
  id: `les_${String(position)}`,
  course_id: 'crs_1',
  slug: `leccion-${String(position)}`,
  title: `Lección ${String(position)}`,
  position,
});

const SAVED = {
  lesson_id: 'les_3',
  completed_at: null,
  last_position_seconds: 252,
  updated_at: new Date('2026-07-02T10:00:05.000Z'),
};

const SEALED = {
  ...SAVED,
  completed_at: new Date('2026-07-02T10:00:06.000Z'),
};

const payload = {
  user_id: 'usr_1',
  lesson_id: 'les_3',
  has_session: true,
  last_position_seconds: 252,
  completed: false,
};

beforeEach(() => {
  findLessonWithCourseByIdMock.mockResolvedValue(LESSON);
  findPublishedLessonRefsByCourseIdsMock.mockResolvedValue([lessonAt(1), lessonAt(2), lessonAt(3)]);
  saveLessonProgressMock.mockResolvedValue(SAVED);
  completeLessonMock.mockResolvedValue({
    progress: SEALED,
    enrollment: {
      course_id: 'crs_1',
      started_at: new Date('2026-07-01T10:00:00.000Z'),
      completed_at: null,
      last_lesson_id: 'les_3',
    },
  });
});

describe('updateLessonProgressService', () => {
  it('guarda el minuto y devuelve el estado de la lección', async () => {
    const result = await updateLessonProgressService(payload);

    expect(saveLessonProgressMock).toHaveBeenCalledWith({
      user_id: 'usr_1',
      lesson_id: 'les_3',
      last_position_seconds: 252,
    });
    expect(result.progress).toEqual({
      lesson_id: 'les_3',
      last_position_seconds: 252,
      completed_at: null,
      updated_at: '2026-07-02T10:00:05.000Z',
    });
  });

  it('sin completed no toca la inscripción ni pide el temario', async () => {
    await updateLessonProgressService(payload);

    expect(completeLessonMock).not.toHaveBeenCalled();
    expect(findPublishedLessonRefsByCourseIdsMock).not.toHaveBeenCalled();
  });

  it('con completed sella la lección con las publicadas de ese momento', async () => {
    const result = await updateLessonProgressService({ ...payload, completed: true });

    expect(completeLessonMock).toHaveBeenCalledWith({
      user_id: 'usr_1',
      lesson_id: 'les_3',
      course_id: 'crs_1',
      published_lesson_ids: ['les_1', 'les_2', 'les_3'],
      completed_at: expect.any(Date) as Date,
    });
    expect(result.progress.completed_at).toBe('2026-07-02T10:00:06.000Z');
  });

  it('una lección de un curso archivado responde 403 LESSON_LOCKED y no guarda nada', async () => {
    findLessonWithCourseByIdMock.mockResolvedValue({
      ...LESSON,
      course: { ...LESSON.course, status: course_status.ARCHIVED },
    });

    await expect(updateLessonProgressService(payload)).rejects.toMatchObject({
      statusCode: HttpStatusCodes.FORBIDDEN.code,
      meta: { code: ErrorCodes.LESSON_LOCKED },
    });
    expect(saveLessonProgressMock).not.toHaveBeenCalled();
  });

  it('una lección que no existe responde 404 y no guarda nada', async () => {
    findLessonWithCourseByIdMock.mockResolvedValue(null);

    await expect(updateLessonProgressService(payload)).rejects.toMatchObject({
      statusCode: HttpStatusCodes.NOT_FOUND.code,
    });
    expect(saveLessonProgressMock).not.toHaveBeenCalled();
  });
});
