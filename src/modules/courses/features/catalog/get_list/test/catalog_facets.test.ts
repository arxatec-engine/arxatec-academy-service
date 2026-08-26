import { course_level, course_topic } from '@/generated/enums';
import { buildCourseFacets } from '@/modules/courses/features/catalog/get_list/domain/catalog_facets';

describe('buildCourseFacets', () => {
  it('rellena con cero los temas y niveles que no devuelve la consulta', () => {
    const facets = buildCourseFacets({ topic_counts: [], level_counts: [] });

    expect(facets).toEqual({
      topic: {
        ALL: 0,
        FIRST_STEPS: 0,
        LEGAL_ENGINEERING: 0,
        APPLIED_AI: 0,
        ARXATEC_PRODUCT: 0,
      },
      level: { INTRODUCTORY: 0, INTERMEDIATE: 0 },
    });
  });

  it('ALL es la suma de los contadores por tema, no el número de temas', () => {
    const facets = buildCourseFacets({
      topic_counts: [
        { topic: course_topic.FIRST_STEPS, count: 1 },
        { topic: course_topic.LEGAL_ENGINEERING, count: 2 },
        { topic: course_topic.APPLIED_AI, count: 1 },
        { topic: course_topic.ARXATEC_PRODUCT, count: 2 },
      ],
      level_counts: [
        { level: course_level.INTRODUCTORY, count: 4 },
        { level: course_level.INTERMEDIATE, count: 2 },
      ],
    });

    expect(facets.topic.ALL).toBe(6);
    expect(facets.level.INTRODUCTORY).toBe(4);
  });
});
