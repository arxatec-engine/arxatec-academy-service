import type {
  CourseRefRecord,
  LessonRefRecord,
} from '@/modules/courses/shared/domain/course_refs.types';
import type {
  CourseProgress,
  EnrollmentRecord,
  LessonProgressRecord,
} from '@/modules/progress/shared/domain/progress.types';
import {
  toApiEnrollment,
  toApiLessonProgress,
  toApiMyCourseCompleted,
  toApiMyCourseInProgress,
  toApiNextLesson,
} from '@/modules/progress/shared/domain/progress_mapper';

const COURSE: CourseRefRecord = {
  id: 'crs_1',
  slug: 'fundamentos-de-legal-tech',
  title: 'Fundamentos de legal tech',
};

const NEXT_LESSON: LessonRefRecord = {
  id: 'les_3',
  course_id: 'crs_1',
  slug: 'las-cuatro-herramientas-que-ya-usas-sin-saberlo',
  title: 'Las cuatro herramientas que ya usas sin saberlo',
  position: 3,
};

const PROGRESS: CourseProgress = {
  completed_lessons: 2,
  lesson_count: 6,
  next_lesson: NEXT_LESSON,
  is_completed: false,
};

const ENROLLMENT: EnrollmentRecord = {
  course_id: 'crs_1',
  started_at: new Date('2026-07-01T10:00:00.000Z'),
  completed_at: null,
  last_lesson_id: 'les_2',
};

describe('progress_mapper', () => {
  it('la inscripción sale con fechas ISO y sin el id interno del curso', () => {
    const api = toApiEnrollment(COURSE, ENROLLMENT, PROGRESS);

    expect(api).toEqual({
      certificate_id: null,
      course: { slug: COURSE.slug, title: COURSE.title },
      started_at: '2026-07-01T10:00:00.000Z',
      completed_at: null,
      completed_lessons: 2,
      lesson_count: 6,
      next_lesson: { slug: NEXT_LESSON.slug, title: NEXT_LESSON.title },
    });
    expect(JSON.stringify(api)).not.toContain('crs_1');
    expect(JSON.stringify(api)).not.toContain('les_3');
  });

  it('la siguiente lección solo lleva slug y título', () => {
    expect(toApiNextLesson(NEXT_LESSON)).toEqual({
      slug: NEXT_LESSON.slug,
      title: NEXT_LESSON.title,
    });
    expect(toApiNextLesson(null)).toBeNull();
  });

  it('la tarjeta de "Continuar" lleva el contador y la siguiente lección', () => {
    expect(toApiMyCourseInProgress(COURSE, PROGRESS)).toEqual({
      certificate_id: null,
      course: { slug: COURSE.slug, title: COURSE.title },
      completed_lessons: 2,
      lesson_count: 6,
      next_lesson: { slug: NEXT_LESSON.slug, title: NEXT_LESSON.title },
    });
  });

  it('la tarjeta de "Ver de nuevo" lleva la fecha en la que se terminó', () => {
    expect(
      toApiMyCourseCompleted(
        COURSE,
        { completed_lessons: 4, lesson_count: 4, next_lesson: null, is_completed: true },
        new Date('2026-07-03T00:00:00.000Z'),
      ),
    ).toEqual({
      certificate_id: null,
      course: { slug: COURSE.slug, title: COURSE.title },
      lesson_count: 4,
      completed_at: '2026-07-03T00:00:00.000Z',
    });
  });

  it('el progreso de una lección sale con el minuto y las fechas ISO', () => {
    const record: LessonProgressRecord = {
      lesson_id: 'les_3',
      completed_at: new Date('2026-07-02T10:00:00.000Z'),
      last_position_seconds: 252,
      updated_at: new Date('2026-07-02T10:00:05.000Z'),
    };

    expect(toApiLessonProgress(record)).toEqual({
      lesson_id: 'les_3',
      last_position_seconds: 252,
      completed_at: '2026-07-02T10:00:00.000Z',
      updated_at: '2026-07-02T10:00:05.000Z',
    });
  });
});
