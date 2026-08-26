import { course_level, course_topic } from '@/generated/enums';
import type { GetListPayload } from '@/modules/courses/features/catalog/get_list/domain/get_list.payload';
import { getListService } from '@/modules/courses/features/catalog/get_list/presentation/get_list.service';
import {
  aggregatePublishedLessons,
  countPublishedCoursesByLevel,
  countPublishedCoursesByTopic,
  findPublishedCourses,
} from '@/modules/courses/shared/data/courses.repository';
import type {
  CourseCatalogRecord,
  CourseLessonAggregate,
} from '@/modules/courses/shared/domain/course.types';

jest.mock('@/modules/courses/shared/data/courses.repository', () => ({
  findPublishedCourses: jest.fn(),
  aggregatePublishedLessons: jest.fn(),
  countPublishedCoursesByTopic: jest.fn(),
  countPublishedCoursesByLevel: jest.fn(),
}));

const findPublishedCoursesMock = jest.mocked(findPublishedCourses);
const aggregatePublishedLessonsMock = jest.mocked(aggregatePublishedLessons);
const countPublishedCoursesByTopicMock = jest.mocked(countPublishedCoursesByTopic);
const countPublishedCoursesByLevelMock = jest.mocked(countPublishedCoursesByLevel);

const course = (
  id: string,
  slug: string,
  title: string,
  short_description: string,
  topic: course_topic,
  level: course_level,
): CourseCatalogRecord => ({
  id,
  slug,
  title,
  short_description,
  topic,
  level,
  cover_image_url: null,
});

const CATALOG: readonly CourseCatalogRecord[] = [
  course(
    'crs_1',
    'fundamentos-de-legal-tech',
    'Fundamentos de legal tech',
    'Qué es legal tech y por dónde empezar sin gastar.',
    course_topic.FIRST_STEPS,
    course_level.INTRODUCTORY,
  ),
  course(
    'crs_2',
    'automatiza-tus-escritos',
    'Automatiza tus escritos',
    'Plantillas y cláusulas reutilizables.',
    course_topic.LEGAL_ENGINEERING,
    course_level.INTERMEDIATE,
  ),
  course(
    'crs_3',
    'ia-aplicada-a-la-practica-legal',
    'IA aplicada a la práctica legal',
    'Resumir, comparar y revisar con criterio.',
    course_topic.APPLIED_AI,
    course_level.INTRODUCTORY,
  ),
];

const AGGREGATES: readonly CourseLessonAggregate[] = [
  { course_id: 'crs_1', lesson_count: 6, duration_seconds: 2404, reading_minutes: 3 },
  { course_id: 'crs_2', lesson_count: 5, duration_seconds: 3480, reading_minutes: 0 },
  { course_id: 'crs_3', lesson_count: 7, duration_seconds: 5040, reading_minutes: 0 },
];

const FULL_TOPIC_COUNTS = [
  { topic: course_topic.FIRST_STEPS, count: 1 },
  { topic: course_topic.LEGAL_ENGINEERING, count: 2 },
  { topic: course_topic.APPLIED_AI, count: 1 },
  { topic: course_topic.ARXATEC_PRODUCT, count: 2 },
];

const FULL_LEVEL_COUNTS = [
  { level: course_level.INTRODUCTORY, count: 4 },
  { level: course_level.INTERMEDIATE, count: 2 },
];

const payload = (overrides: Partial<GetListPayload> = {}): GetListPayload => ({
  topic: [],
  level: [],
  search: undefined,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  findPublishedCoursesMock.mockResolvedValue(CATALOG);
  aggregatePublishedLessonsMock.mockResolvedValue(AGGREGATES);
  countPublishedCoursesByTopicMock.mockResolvedValue(FULL_TOPIC_COUNTS);
  countPublishedCoursesByLevelMock.mockResolvedValue(FULL_LEVEL_COUNTS);
});

describe('getListService · catálogo', () => {
  it('devuelve el catálogo completo con sus totales agregados', async () => {
    const result = await getListService(payload());

    expect(findPublishedCoursesMock).toHaveBeenCalledWith({ topics: [], levels: [] });
    expect(result.courses).toHaveLength(3);
    expect(result.courses[0]).toEqual({
      slug: 'fundamentos-de-legal-tech',
      title: 'Fundamentos de legal tech',
      short_description: 'Qué es legal tech y por dónde empezar sin gastar.',
      topic: course_topic.FIRST_STEPS,
      level: course_level.INTRODUCTORY,
      cover_image_url: null,
      lesson_count: 6,
      total_duration_seconds: 2584,
    });
  });

  it('un curso sin lecciones publicadas sale con lesson_count 0 y duración 0', async () => {
    aggregatePublishedLessonsMock.mockResolvedValue([]);

    const result = await getListService(payload());

    expect(result.courses.map((item) => item.lesson_count)).toEqual([0, 0, 0]);
    expect(result.courses.map((item) => item.total_duration_seconds)).toEqual([0, 0, 0]);
  });
});

describe('getListService · facetas', () => {
  it('con un tema filtrado, los contadores de los OTROS temas no cambian', async () => {
    findPublishedCoursesMock.mockResolvedValue([CATALOG[2]]);

    const result = await getListService(payload({ topic: [course_topic.APPLIED_AI] }));

    expect(result.courses).toHaveLength(1);
    expect(result.facets.topic).toEqual({
      ALL: 6,
      FIRST_STEPS: 1,
      LEGAL_ENGINEERING: 2,
      APPLIED_AI: 1,
      ARXATEC_PRODUCT: 2,
    });
  });

  it('las facetas de tema NO aplican el filtro de tema, y sí el de nivel', async () => {
    await getListService(
      payload({ topic: [course_topic.APPLIED_AI], level: [course_level.INTERMEDIATE] }),
    );

    expect(countPublishedCoursesByTopicMock).toHaveBeenCalledWith([course_level.INTERMEDIATE]);
    expect(countPublishedCoursesByLevelMock).toHaveBeenCalledWith([course_topic.APPLIED_AI]);
  });

  it('ALL es la suma de los contadores por tema con el filtro de nivel puesto', async () => {
    countPublishedCoursesByTopicMock.mockResolvedValue([
      { topic: course_topic.LEGAL_ENGINEERING, count: 2 },
    ]);
    countPublishedCoursesByLevelMock.mockResolvedValue(FULL_LEVEL_COUNTS);

    const result = await getListService(payload({ level: [course_level.INTERMEDIATE] }));

    expect(result.facets.topic).toEqual({
      ALL: 2,
      FIRST_STEPS: 0,
      LEGAL_ENGINEERING: 2,
      APPLIED_AI: 0,
      ARXATEC_PRODUCT: 0,
    });
    expect(result.facets.level).toEqual({ INTRODUCTORY: 4, INTERMEDIATE: 2 });
  });
});

describe('getListService · búsqueda', () => {
  it('sin resultados devuelve lista vacía y las facetas intactas', async () => {
    const result = await getListService(payload({ search: 'blockchain' }));

    expect(result.courses).toEqual([]);
    expect(result.facets.topic).toEqual({
      ALL: 6,
      FIRST_STEPS: 1,
      LEGAL_ENGINEERING: 2,
      APPLIED_AI: 1,
      ARXATEC_PRODUCT: 2,
    });
    expect(result.facets.level).toEqual({ INTRODUCTORY: 4, INTERMEDIATE: 2 });
  });

  it('"IA aplicada" encuentra lo mismo que "ia aplicada"', async () => {
    const accented = await getListService(payload({ search: 'IA aplicada' }));
    const plain = await getListService(payload({ search: 'ia aplicada' }));

    expect(plain.courses).toEqual(accented.courses);
    expect(plain.courses.map((item) => item.slug)).toEqual(['ia-aplicada-a-la-practica-legal']);
  });

  it('encuentra con y sin acentos en el título', async () => {
    const withAccent = await getListService(payload({ search: 'práctica' }));
    const withoutAccent = await getListService(payload({ search: 'practica' }));

    expect(withAccent.courses.map((item) => item.slug)).toEqual([
      'ia-aplicada-a-la-practica-legal',
    ]);
    expect(withoutAccent.courses).toEqual(withAccent.courses);
  });

  it('busca también en la descripción corta', async () => {
    const result = await getListService(payload({ search: 'clausulas' }));

    expect(result.courses.map((item) => item.slug)).toEqual(['automatiza-tus-escritos']);
  });

  it('la búsqueda no viaja al repositorio: filtra sobre el catálogo publicado', async () => {
    await getListService(payload({ search: 'blockchain' }));

    expect(findPublishedCoursesMock).toHaveBeenCalledWith({ topics: [], levels: [] });
  });
});
