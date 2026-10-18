jest.mock('@/config/prisma_client', () => ({
  prisma: {
    courses: { findMany: jest.fn(), findFirst: jest.fn(), groupBy: jest.fn() },
    lessons: { findMany: jest.fn(), findFirst: jest.fn(), groupBy: jest.fn() },
  },
}));

import { prisma } from '@/config/prisma_client';
import { course_level, course_status, course_topic, lesson_status } from '@/generated/enums';
import {
  aggregatePublishedLessons,
  countPublishedCoursesByLevel,
  countPublishedCoursesByTopic,
  findPublishedCourseBySlug,
  findPublishedCourses,
  findPublishedLessonLocked,
  findPublishedLessonUnlocked,
  findPublishedLessonsByCourseId,
} from '@/modules/courses/shared/data/courses.repository';

const coursesFindMany = jest.spyOn(prisma.courses, 'findMany');
const coursesFindFirst = jest.spyOn(prisma.courses, 'findFirst');
const coursesGroupBy = jest.spyOn(prisma.courses, 'groupBy');
const lessonsFindMany = jest.spyOn(prisma.lessons, 'findMany');
const lessonsFindFirst = jest.spyOn(prisma.lessons, 'findFirst');
const lessonsGroupBy = jest.spyOn(prisma.lessons, 'groupBy');

const CATALOG_SELECT = {
  id: true,
  slug: true,
  title: true,
  short_description: true,
  topic: true,
  level: true,
  cover_image_url: true,
};

const DETAIL_SELECT = {
  teacher: { select: { full_name: true, biography: true, photo_url: true } },
  id: true,
  slug: true,
  title: true,
  long_description: true,
  topic: true,
  level: true,
  cover_image_url: true,
  published_at: true,
};

const LESSON_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  type: true,
  position: true,
  duration_seconds: true,
  reading_minutes: true,
  is_free_sample: true,
};

const LESSON_LOCKED_SELECT = {
  id: true,
  slug: true,
  title: true,
  description: true,
  type: true,
  position: true,
  is_free_sample: true,
  duration_seconds: true,
  reading_minutes: true,
};

const LESSON_UNLOCKED_SELECT = {
  ...LESSON_LOCKED_SELECT,
  video_provider: true,
  video_external_id: true,
  article_body: true,
  transcript: true,
  updated_at: true,
  resources: {
    select: { title: true, file_url: true, mime_type: true, size_bytes: true },
    orderBy: { position: 'asc' },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  coursesFindMany.mockResolvedValue([]);
  coursesFindFirst.mockResolvedValue(null);
  coursesGroupBy.mockResolvedValue([]);
  lessonsFindMany.mockResolvedValue([]);
  lessonsFindFirst.mockResolvedValue(null);
  lessonsGroupBy.mockResolvedValue([]);
});

describe('courses.repository · select explícito', () => {
  it('el catálogo pide siete columnas y ninguna más', async () => {
    await findPublishedCourses({ topics: [], levels: [] });

    expect(coursesFindMany).toHaveBeenCalledWith({
      where: { status: course_status.PUBLISHED },
      select: CATALOG_SELECT,
      orderBy: { catalog_order: 'asc' },
    });
  });

  it('la ficha no pide status, catalog_order ni las marcas de tiempo', async () => {
    await findPublishedCourseBySlug('fundamentos-de-legal-tech');

    expect(coursesFindFirst).toHaveBeenCalledWith({
      where: { slug: 'fundamentos-de-legal-tech', status: course_status.PUBLISHED },
      select: DETAIL_SELECT,
    });
  });

  it('el temario no pide article_body, transcript ni los datos del video', async () => {
    await findPublishedLessonsByCourseId('crs_1');

    expect(lessonsFindMany).toHaveBeenCalledWith({
      where: { course_id: 'crs_1', status: lesson_status.PUBLISHED },
      select: LESSON_SELECT,
      orderBy: { position: 'asc' },
    });
    expect(Object.keys(LESSON_SELECT)).not.toContain('article_body');
    expect(Object.keys(LESSON_SELECT)).not.toContain('transcript');
    expect(Object.keys(LESSON_SELECT)).not.toContain('video_external_id');
  });
});

describe('courses.repository · solo lo publicado', () => {
  it('el catálogo aplica los filtros de tema y nivel sobre lo publicado', async () => {
    await findPublishedCourses({
      topics: [course_topic.APPLIED_AI, course_topic.FIRST_STEPS],
      levels: [course_level.INTRODUCTORY],
    });

    expect(coursesFindMany).toHaveBeenCalledWith({
      where: {
        status: course_status.PUBLISHED,
        topic: { in: [course_topic.APPLIED_AI, course_topic.FIRST_STEPS] },
        level: { in: [course_level.INTRODUCTORY] },
      },
      select: CATALOG_SELECT,
      orderBy: { catalog_order: 'asc' },
    });
  });

  it('los totales agregan lecciones publicadas de cursos publicados, en la consulta', async () => {
    await aggregatePublishedLessons({ topics: [], levels: [course_level.INTERMEDIATE] });

    expect(lessonsGroupBy).toHaveBeenCalledWith({
      by: ['course_id'],
      where: {
        status: lesson_status.PUBLISHED,
        course: {
          status: course_status.PUBLISHED,
          level: { in: [course_level.INTERMEDIATE] },
        },
      },
      _count: { _all: true },
      _sum: { duration_seconds: true, reading_minutes: true },
    });
  });
});

describe('courses.repository · facetas', () => {
  it('los contadores por tema NO llevan el filtro de tema, y sí el de nivel', async () => {
    await countPublishedCoursesByTopic([course_level.INTERMEDIATE]);

    expect(coursesGroupBy).toHaveBeenCalledWith({
      by: ['topic'],
      where: {
        status: course_status.PUBLISHED,
        level: { in: [course_level.INTERMEDIATE] },
      },
      _count: { _all: true },
    });
  });

  it('los contadores por nivel NO llevan el filtro de nivel, y sí el de tema', async () => {
    await countPublishedCoursesByLevel([course_topic.APPLIED_AI]);

    expect(coursesGroupBy).toHaveBeenCalledWith({
      by: ['level'],
      where: {
        status: course_status.PUBLISHED,
        topic: { in: [course_topic.APPLIED_AI] },
      },
      _count: { _all: true },
    });
  });
});

describe('courses.repository · las dos formas de una lección', () => {
  it('la forma bloqueada no pide ni una sola columna de contenido', async () => {
    await findPublishedLessonLocked('crs_1', 'las-cuatro-herramientas-que-ya-usas-sin-saberlo');

    expect(lessonsFindFirst).toHaveBeenCalledWith({
      where: {
        course_id: 'crs_1',
        slug: 'las-cuatro-herramientas-que-ya-usas-sin-saberlo',
        status: lesson_status.PUBLISHED,
      },
      select: LESSON_LOCKED_SELECT,
    });

    for (const column of [
      'video_provider',
      'video_external_id',
      'article_body',
      'transcript',
      'resources',
    ]) {
      expect(Object.keys(LESSON_LOCKED_SELECT)).not.toContain(column);
    }
  });

  it('la forma abierta pide el contenido y los recursos ordenados por position', async () => {
    await findPublishedLessonUnlocked('crs_1', 'las-cuatro-herramientas-que-ya-usas-sin-saberlo');

    expect(lessonsFindFirst).toHaveBeenCalledWith({
      where: {
        course_id: 'crs_1',
        slug: 'las-cuatro-herramientas-que-ya-usas-sin-saberlo',
        status: lesson_status.PUBLISHED,
      },
      select: LESSON_UNLOCKED_SELECT,
    });
  });

  it('las dos formas solo miran lecciones publicadas del curso pedido', async () => {
    await findPublishedLessonLocked('crs_1', 'una-leccion');
    await findPublishedLessonUnlocked('crs_1', 'una-leccion');

    for (const call of lessonsFindFirst.mock.calls) {
      expect(call[0]?.where).toEqual({
        course_id: 'crs_1',
        slug: 'una-leccion',
        status: lesson_status.PUBLISHED,
      });
    }
  });
});
