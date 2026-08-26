jest.mock('@/config/prisma_client', () => ({
  prisma: {
    courses: { findMany: jest.fn() },
    lessons: { findMany: jest.fn(), findUnique: jest.fn() },
  },
}));

import { prisma } from '@/config/prisma_client';
import { course_status, lesson_status } from '@/generated/enums';
import {
  findLessonWithCourseById,
  findPublishedCoursesByIds,
  findPublishedLessonRefsByCourseIds,
} from '@/modules/courses/shared/data/course_refs.repository';

const coursesFindMany = jest.spyOn(prisma.courses, 'findMany');
const lessonsFindMany = jest.spyOn(prisma.lessons, 'findMany');
const lessonsFindUnique = jest.spyOn(prisma.lessons, 'findUnique');

const COURSE_REF_SELECT = { id: true, slug: true, title: true };

const LESSON_REF_SELECT = {
  id: true,
  course_id: true,
  slug: true,
  title: true,
  position: true,
};

const LESSON_WITH_COURSE_SELECT = {
  id: true,
  slug: true,
  title: true,
  is_free_sample: true,
  status: true,
  course: { select: { id: true, slug: true, title: true, status: true } },
};

beforeEach(() => {
  jest.clearAllMocks();
  coursesFindMany.mockResolvedValue([]);
  lessonsFindMany.mockResolvedValue([]);
  lessonsFindUnique.mockResolvedValue(null);
});

describe('course_refs.repository', () => {
  it('los cursos de "Mis cursos" salen solo si siguen publicados', async () => {
    await findPublishedCoursesByIds(['crs_1', 'crs_2']);

    expect(coursesFindMany).toHaveBeenCalledWith({
      where: { id: { in: ['crs_1', 'crs_2'] }, status: course_status.PUBLISHED },
      select: COURSE_REF_SELECT,
      orderBy: { catalog_order: 'asc' },
    });
  });

  it('las referencias de lección solo traen lo publicado, ordenado por posición', async () => {
    await findPublishedLessonRefsByCourseIds(['crs_1']);

    expect(lessonsFindMany).toHaveBeenCalledWith({
      where: { course_id: { in: ['crs_1'] }, status: lesson_status.PUBLISHED },
      select: LESSON_REF_SELECT,
      orderBy: [{ course_id: 'asc' }, { position: 'asc' }],
    });
    expect(Object.keys(LESSON_REF_SELECT)).not.toContain('article_body');
    expect(Object.keys(LESSON_REF_SELECT)).not.toContain('transcript');
    expect(Object.keys(LESSON_REF_SELECT)).not.toContain('video_external_id');
  });

  it('la lección para marcar se lee SIN filtrar por estado: el estado lo decide la política', async () => {
    await findLessonWithCourseById('les_3');

    expect(lessonsFindUnique).toHaveBeenCalledWith({
      where: { id: 'les_3' },
      select: LESSON_WITH_COURSE_SELECT,
    });
  });
});
