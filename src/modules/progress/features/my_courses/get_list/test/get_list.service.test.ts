import {
  findPublishedCoursesByIds,
  findPublishedLessonRefsByCourseIds,
} from '@/modules/courses/shared/data/course_refs.repository';
import type {
  CourseRefRecord,
  LessonRefRecord,
} from '@/modules/courses/shared/domain/course_refs.types';
import { getMyCoursesService } from '@/modules/progress/features/my_courses/get_list/presentation/get_list.service';
import {
  findCompletedLessonIds,
  findEnrollmentsByUser,
} from '@/modules/progress/shared/data/progress.repository';
import type { EnrollmentRecord } from '@/modules/progress/shared/domain/progress.types';

jest.mock('@/modules/courses/shared/data/course_refs.repository', () => ({
  findPublishedCoursesByIds: jest.fn(),
  findPublishedLessonRefsByCourseIds: jest.fn(),
}));

jest.mock('@/modules/progress/shared/data/progress.repository', () => ({
  findEnrollmentsByUser: jest.fn(),
  findCompletedLessonIds: jest.fn(),
}));

const findPublishedCoursesByIdsMock = jest.mocked(findPublishedCoursesByIds);
const findPublishedLessonRefsByCourseIdsMock = jest.mocked(findPublishedLessonRefsByCourseIds);
const findEnrollmentsByUserMock = jest.mocked(findEnrollmentsByUser);
const findCompletedLessonIdsMock = jest.mocked(findCompletedLessonIds);

const FIRST_COURSE: CourseRefRecord = {
  id: 'crs_1',
  slug: 'fundamentos-de-legal-tech',
  title: 'Fundamentos de legal tech',
};

const SECOND_COURSE: CourseRefRecord = {
  id: 'crs_2',
  slug: 'expedientes-sin-excel',
  title: 'Expedientes sin Excel',
};

const lessonOf = (course_id: string, position: number): LessonRefRecord => ({
  id: `${course_id}_les_${String(position)}`,
  course_id,
  slug: `${course_id}-leccion-${String(position)}`,
  title: `Lección ${String(position)}`,
  position,
});

const FIRST_LESSONS = [lessonOf('crs_1', 1), lessonOf('crs_1', 2), lessonOf('crs_1', 3)];
const SECOND_LESSONS = [lessonOf('crs_2', 1), lessonOf('crs_2', 2)];

const SEALED_AT = new Date('2026-07-03T00:00:00.000Z');

const enrollmentOf = (course_id: string, completed_at: Date | null): EnrollmentRecord => ({
  course_id,
  started_at: new Date('2026-07-01T10:00:00.000Z'),
  completed_at,
  last_lesson_id: null,
});

const payload = { user_id: 'usr_1' };

beforeEach(() => {
  findEnrollmentsByUserMock.mockResolvedValue([
    enrollmentOf('crs_1', null),
    enrollmentOf('crs_2', SEALED_AT),
  ]);
  findPublishedCoursesByIdsMock.mockResolvedValue([FIRST_COURSE, SECOND_COURSE]);
  findPublishedLessonRefsByCourseIdsMock.mockResolvedValue([...FIRST_LESSONS, ...SECOND_LESSONS]);
  findCompletedLessonIdsMock.mockResolvedValue([
    'crs_1_les_1',
    'crs_2_les_1',
    'crs_2_les_2',
  ]);
});

describe('getMyCoursesService', () => {
  it('cero inscripciones es 200 con dos listas vacías, no un error', async () => {
    findEnrollmentsByUserMock.mockResolvedValue([]);

    await expect(getMyCoursesService(payload)).resolves.toEqual({
      in_progress: [],
      completed: [],
    });
    expect(findPublishedCoursesByIdsMock).not.toHaveBeenCalled();
  });

  it('reparte en dos listas: lo empezado y lo terminado', async () => {
    const result = await getMyCoursesService(payload);

    expect(result.in_progress).toEqual([
      {
        certificate_id: null,
        course: { slug: FIRST_COURSE.slug, title: FIRST_COURSE.title },
        completed_lessons: 1,
        lesson_count: 3,
        next_lesson: { slug: 'crs_1-leccion-2', title: 'Lección 2' },
      },
    ]);
    expect(result.completed).toEqual([
      {
        certificate_id: null,
        course: { slug: SECOND_COURSE.slug, title: SECOND_COURSE.title },
        lesson_count: 2,
        completed_at: SEALED_AT.toISOString(),
      },
    ]);
  });

  it('la siguiente lección es la primera NO completada, no la siguiente en orden', async () => {
    findCompletedLessonIdsMock.mockResolvedValue(['crs_1_les_1', 'crs_1_les_3']);

    const result = await getMyCoursesService(payload);

    expect(result.in_progress[0]?.next_lesson).toEqual({
      slug: 'crs_1-leccion-2',
      title: 'Lección 2',
    });
  });

  it('publicar una lección nueva devuelve el curso terminado a "en curso" sin borrar su fecha', async () => {
    findPublishedLessonRefsByCourseIdsMock.mockResolvedValue([
      ...FIRST_LESSONS,
      ...SECOND_LESSONS,
      lessonOf('crs_2', 3),
    ]);

    const result = await getMyCoursesService(payload);

    expect(result.completed).toEqual([]);
    expect(result.in_progress).toContainEqual({
      certificate_id: null,
      course: { slug: SECOND_COURSE.slug, title: SECOND_COURSE.title },
      completed_lessons: 2,
      lesson_count: 3,
      next_lesson: { slug: 'crs_2-leccion-3', title: 'Lección 3' },
    });
  });

  it('un curso archivado después de inscribirse desaparece de la lista', async () => {
    findPublishedCoursesByIdsMock.mockResolvedValue([FIRST_COURSE]);
    findPublishedLessonRefsByCourseIdsMock.mockResolvedValue([...FIRST_LESSONS]);

    const result = await getMyCoursesService(payload);

    expect(result.in_progress).toHaveLength(1);
    expect(result.completed).toHaveLength(0);
  });

  it('un curso con la fecha sellada pero sin lecciones publicadas no está terminado', async () => {
    findEnrollmentsByUserMock.mockResolvedValue([enrollmentOf('crs_2', SEALED_AT)]);
    findPublishedCoursesByIdsMock.mockResolvedValue([SECOND_COURSE]);
    findPublishedLessonRefsByCourseIdsMock.mockResolvedValue([]);
    findCompletedLessonIdsMock.mockResolvedValue([]);

    const result = await getMyCoursesService(payload);

    expect(result.completed).toEqual([]);
    expect(result.in_progress).toEqual([
      {
        certificate_id: null,
        course: { slug: SECOND_COURSE.slug, title: SECOND_COURSE.title },
        completed_lessons: 0,
        lesson_count: 0,
        next_lesson: null,
      },
    ]);
  });

  it('pide las completadas acotadas a las lecciones publicadas de sus cursos', async () => {
    await getMyCoursesService(payload);

    expect(findCompletedLessonIdsMock).toHaveBeenCalledWith('usr_1', [
      'crs_1_les_1',
      'crs_1_les_2',
      'crs_1_les_3',
      'crs_2_les_1',
      'crs_2_les_2',
    ]);
  });
});
