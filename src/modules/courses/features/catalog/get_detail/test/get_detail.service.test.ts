import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CourseMessages } from '@/constants/messages/courses';
import { course_level, course_topic, lesson_type } from '@/generated/enums';
import { getDetailService } from '@/modules/courses/features/catalog/get_detail/presentation/get_detail.service';
import {
  findPublishedCourseBySlug,
  findPublishedLessonsByCourseId,
} from '@/modules/courses/shared/data/courses.repository';
import type {
  CourseDetailRecord,
  LessonSummaryRecord,
} from '@/modules/courses/shared/domain/course.types';
import { isAppError, type AppError } from '@/utils/errors';

jest.mock('@/modules/courses/shared/data/courses.repository', () => ({
  findPublishedCourseBySlug: jest.fn(),
  findPublishedLessonsByCourseId: jest.fn(),
}));

const findPublishedCourseBySlugMock = jest.mocked(findPublishedCourseBySlug);
const findPublishedLessonsByCourseIdMock = jest.mocked(findPublishedLessonsByCourseId);

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

const LESSONS: readonly LessonSummaryRecord[] = [
  {
    id: 'lesson-1',
    slug: 'que-es-legal-tech-y-que-no',
    title: 'Qué es legal tech y qué no',
    description: 'Separamos tres cosas que suelen ir revueltas.',
    type: lesson_type.VIDEO,
    position: 1,
    duration_seconds: 480,
    reading_minutes: null,
    is_free_sample: true,
  },
  {
    id: 'lesson-2',
    slug: 'el-costo-oculto-de-trabajar-en-word-y-correo',
    title: 'El costo oculto de trabajar en Word y correo',
    description: 'Cuánto tiempo se pierde buscando la última versión.',
    type: lesson_type.ARTICLE,
    position: 2,
    duration_seconds: null,
    reading_minutes: 2,
    is_free_sample: false,
  },
  {
    id: 'lesson-3',
    slug: 'las-cuatro-herramientas-que-ya-usas-sin-saberlo',
    title: 'Las cuatro herramientas que ya usas sin saberlo',
    description: 'Firma digital, notificaciones electrónicas y dos más.',
    type: lesson_type.VIDEO,
    position: 3,
    duration_seconds: 664,
    reading_minutes: null,
    is_free_sample: false,
  },
];

const captureError = async (promise: Promise<unknown>): Promise<AppError> => {
  try {
    await promise;
  } catch (error) {
    if (isAppError(error)) {
      return error;
    }

    throw error;
  }

  throw new Error('Se esperaba un AppError y la promesa se resolvio');
};

beforeEach(() => {
  jest.clearAllMocks();
  findPublishedCourseBySlugMock.mockResolvedValue(COURSE);
  findPublishedLessonsByCourseIdMock.mockResolvedValue(LESSONS);
});

describe('getDetailService', () => {
  it('devuelve la ficha con los contadores del temario publicado', async () => {
    const result = await getDetailService({ slug: COURSE.slug, has_session: false });

    expect(findPublishedCourseBySlugMock).toHaveBeenCalledWith(COURSE.slug);
    expect(findPublishedLessonsByCourseIdMock).toHaveBeenCalledWith('crs_1');
    expect(result.course).toEqual({
      teacher: null,
      slug: COURSE.slug,
      title: COURSE.title,
      long_description: COURSE.long_description,
      topic: course_topic.FIRST_STEPS,
      level: course_level.INTRODUCTORY,
      cover_image_url: null,
      lesson_count: 3,
      video_count: 2,
      article_count: 1,
      total_duration_seconds: 1264,
      published_at: '2026-06-01T12:00:00.000Z',
    });
  });

  it('sin sesión, solo la muestra gratuita viene desbloqueada', async () => {
    const result = await getDetailService({ slug: COURSE.slug, has_session: false });

    expect(result.lessons.map((lesson) => lesson.is_unlocked)).toEqual([true, false, false]);
  });

  it('con sesión, todas las lecciones vienen desbloqueadas', async () => {
    const result = await getDetailService({ slug: COURSE.slug, has_session: true });

    expect(result.lessons.map((lesson) => lesson.is_unlocked)).toEqual([true, true, true]);
  });

  it('el temario completo es público: título, tipo, duración y descripción de todas', async () => {
    const result = await getDetailService({ slug: COURSE.slug, has_session: false });

    expect(result.lessons).toHaveLength(3);
    expect(result.lessons[1]).toEqual({
      id: 'lesson-2',
      slug: 'el-costo-oculto-de-trabajar-en-word-y-correo',
      title: 'El costo oculto de trabajar en Word y correo',
      description: 'Cuánto tiempo se pierde buscando la última versión.',
      type: lesson_type.ARTICLE,
      position: 2,
      duration_seconds: null,
      reading_minutes: 2,
      is_free_sample: false,
      is_unlocked: false,
    });
  });

  it('un curso en borrador o archivado no existe para este endpoint: 404 NOT_FOUND', async () => {
    findPublishedCourseBySlugMock.mockResolvedValue(null);

    const error = await captureError(
      getDetailService({ slug: 'curso-en-borrador', has_session: true }),
    );

    expect(error.statusCode).toBe(HttpStatusCodes.NOT_FOUND.code);
    expect(error.meta).toEqual({ code: ErrorCodes.NOT_FOUND });
    expect(error.message).toBe(CourseMessages.course.not_found);
  });

  it('no consulta las lecciones si el curso no existe', async () => {
    findPublishedCourseBySlugMock.mockResolvedValue(null);

    await captureError(getDetailService({ slug: 'curso-en-borrador', has_session: false }));

    expect(findPublishedLessonsByCourseIdMock).not.toHaveBeenCalled();
  });

  it('un curso publicado sin lecciones publicadas responde con el temario vacío (E4)', async () => {
    findPublishedLessonsByCourseIdMock.mockResolvedValue([]);

    const result = await getDetailService({ slug: COURSE.slug, has_session: false });

    expect(result.lessons).toEqual([]);
    expect(result.course.lesson_count).toBe(0);
    expect(result.course.total_duration_seconds).toBe(0);
  });
});
