import { course_level, course_topic, lesson_type } from '@/generated/enums';
import type {
  CourseCatalogRecord,
  CourseDetailRecord,
  LessonSummaryRecord,
} from '@/modules/courses/shared/domain/course.types';
import {
  toApiCatalogCourse,
  toApiCourseDetail,
  toApiLessonSummary,
} from '@/modules/courses/shared/domain/course_mapper';
import { summarizeLessons, toCourseTotals } from '@/modules/courses/shared/domain/course_totals';

const CATALOG_RECORD: CourseCatalogRecord = {
  id: 'crs_1',
  slug: 'fundamentos-de-legal-tech',
  title: 'Fundamentos de legal tech',
  short_description: 'Qué es legal tech y por dónde empezar.',
  topic: course_topic.FIRST_STEPS,
  level: course_level.INTRODUCTORY,
  cover_image_url: null,
};

const DETAIL_RECORD: CourseDetailRecord = {
  teacher: null,
  id: 'crs_1',
  slug: 'fundamentos-de-legal-tech',
  title: 'Fundamentos de legal tech',
  long_description: 'Seis lecciones para entender de qué hablan.',
  topic: course_topic.FIRST_STEPS,
  level: course_level.INTRODUCTORY,
  cover_image_url: null,
  published_at: new Date('2026-06-01T12:00:00.000Z'),
};

const VIDEO_LESSON: LessonSummaryRecord = {
  id: 'lesson-1',
  slug: 'que-es-legal-tech-y-que-no',
  title: 'Qué es legal tech y qué no',
  description: 'Separamos tres cosas que suelen ir revueltas.',
  type: lesson_type.VIDEO,
  position: 1,
  duration_seconds: 480,
  reading_minutes: null,
  is_free_sample: true,
};

const ARTICLE_LESSON: LessonSummaryRecord = {
  id: 'lesson-2',
  slug: 'el-costo-oculto-de-trabajar-en-word-y-correo',
  title: 'El costo oculto de trabajar en Word y correo',
  description: 'Cuánto tiempo se pierde buscando la última versión.',
  type: lesson_type.ARTICLE,
  position: 2,
  duration_seconds: null,
  reading_minutes: 2,
  is_free_sample: false,
};

describe('course_mapper', () => {
  it('la ficha publica solo nombre, biografía y foto del docente', () => {
    const teacher = {
      id: 'teacher-private', full_name: 'Ana Pérez', biography: 'Docente de legal tech.',
      photo_url: 'https://example.test/ana.jpg',
    };
    const mapped = toApiCourseDetail({ ...DETAIL_RECORD, teacher }, summarizeLessons([]));
    expect(mapped.teacher).toEqual({
      full_name: teacher.full_name, biography: teacher.biography, photo_url: teacher.photo_url,
    });
    expect(toApiCourseDetail(DETAIL_RECORD, summarizeLessons([])).teacher).toBeNull();
  });

  it('el curso del catálogo no lleva el id interno', () => {
    const mapped = toApiCatalogCourse(
      CATALOG_RECORD,
      toCourseTotals({
        course_id: 'crs_1',
        lesson_count: 6,
        duration_seconds: 2404,
        reading_minutes: 3,
      }),
    );

    expect(Object.keys(mapped)).not.toContain('id');
    expect(mapped.total_duration_seconds).toBe(2584);
  });

  it('la ficha serializa published_at a ISO 8601 y tampoco lleva el id', () => {
    const mapped = toApiCourseDetail(
      DETAIL_RECORD,
      summarizeLessons([VIDEO_LESSON, ARTICLE_LESSON]),
    );

    expect(mapped.published_at).toBe('2026-06-01T12:00:00.000Z');
    expect(Object.keys(mapped)).not.toContain('id');
  });

  it('un curso sin fecha de publicación sale con published_at nulo', () => {
    const mapped = toApiCourseDetail(
      { ...DETAIL_RECORD, published_at: null },
      summarizeLessons([]),
    );

    expect(mapped.published_at).toBeNull();
  });

  it('la lección expone el temario y añade is_unlocked, y nada más', () => {
    const mapped = toApiLessonSummary(ARTICLE_LESSON, false);

    expect(Object.keys(mapped).sort()).toEqual(
      [
        'description',
        'duration_seconds',
        'id',
        'is_free_sample',
        'is_unlocked',
        'position',
        'reading_minutes',
        'slug',
        'title',
        'type',
      ].sort(),
    );
  });
});

describe('course_totals', () => {
  it('cuenta videos y artículos por separado y suma la lectura como tiempo', () => {
    expect(summarizeLessons([VIDEO_LESSON, ARTICLE_LESSON])).toEqual({
      lesson_count: 2,
      video_count: 1,
      article_count: 1,
      total_duration_seconds: 600,
    });
  });

  it('un curso sin agregado devuelve ceros en vez de reventar', () => {
    expect(toCourseTotals(undefined)).toEqual({ lesson_count: 0, total_duration_seconds: 0 });
  });
});
