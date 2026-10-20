jest.mock('@/modules/courses/shared/data/courses.repository', () => ({
  findPublishedCourseBySlug: jest.fn(),
}));
jest.mock('@/modules/progress/shared/data/exams.repository', () => ({
  findCourseExam: jest.fn(),
  readExamProgress: jest.fn(),
}));

import { findPublishedCourseBySlug } from '@/modules/courses/shared/data/courses.repository';
import { findCourseExam, readExamProgress } from '@/modules/progress/shared/data/exams.repository';
import { course_level, course_topic } from '@/generated/enums';
import { getCourseExamService } from '../get_detail/presentation/get_detail.service';

const questions = Array.from({ length: 15 }, (_, index) => ({
  text: `Pregunta ${index + 1}`,
  options: ['A', 'B', 'C', 'D'],
  correct_option: index % 4,
}));
const course = {
  teacher: null,
  id: 'course-1',
  slug: 'curso',
  title: 'Curso',
  long_description: '',
  topic: course_topic.FIRST_STEPS,
  level: course_level.INTRODUCTORY,
  cover_image_url: null, cover_image_key: null,
  published_at: new Date(),
};
beforeEach(() => {
  jest.mocked(findPublishedCourseBySlug).mockResolvedValue(course);
  jest.mocked(findCourseExam).mockResolvedValue({
    id: 'exam-1',
    version: 1,
    enabled: true,
    passing_score: 12,
    questions,
    updated_at: new Date(),
  });
  jest.mocked(readExamProgress).mockResolvedValue({
    enrollment: { completed_at: new Date(), certificate: null },
    ready: true,
    latest: null,
  });
});

it('solo entrega enunciados y opciones: no filtra la clave correcta al alumno', async () => {
  const { exam } = await getCourseExamService('user-1', 'curso');
  expect(exam.status).toBe('ready');
  expect(exam.questions).toHaveLength(15);
  expect(exam.questions[0]).toEqual({ text: 'Pregunta 1', options: ['A', 'B', 'C', 'D'] });
  expect(JSON.stringify(exam)).not.toContain('correct_option');
});
it('oculta las preguntas hasta completar todas las lecciones', async () => {
  jest.mocked(readExamProgress).mockResolvedValue({ enrollment: null, ready: false, latest: null });
  expect((await getCourseExamService('user-1', 'curso')).exam).toMatchObject({
    status: 'locked',
    questions: [],
  });
});
it('oculta las preguntas de un examen no configurado', async () => {
  jest.mocked(findCourseExam).mockResolvedValue(null);
  expect((await getCourseExamService('user-1', 'curso')).exam).toMatchObject({
    status: 'unavailable',
    questions: [],
  });
});
it('mantiene accesibles los certificados emitidos antes de los exámenes', async () => {
  jest.mocked(findCourseExam).mockResolvedValue(null);
  jest.mocked(readExamProgress).mockResolvedValue({
    enrollment: {
      completed_at: new Date(),
      certificate: { id: 'certificate-1', exam_attempt: null },
    },
    ready: true,
    latest: null,
  });
  expect((await getCourseExamService('user-1', 'curso')).exam).toMatchObject({
    status: 'passed',
    questions: [],
    certificate_id: 'certificate-1',
  });
});
it('no expone cursos no publicados o inexistentes', async () => {
  jest.mocked(findPublishedCourseBySlug).mockResolvedValue(null);
  await expect(getCourseExamService('user-1', 'curso')).rejects.toMatchObject({ statusCode: 404 });
});

it('muestra la nota del intento que emitió el certificado aunque otro intento tenga fecha posterior', async () => {
  jest.mocked(readExamProgress).mockResolvedValue({
    enrollment: {
      completed_at: new Date(),
      certificate: {
        id: 'certificate-1',
        exam_attempt: { score: 12, passed: true, passing_score: 12 },
      },
    },
    ready: true,
    latest: { score: 11, passed: false, passing_score: 12 },
  });
  const { exam } = await getCourseExamService('user-1', 'curso');
  expect(exam).toMatchObject({
    status: 'passed',
    certificate_id: 'certificate-1',
    last_result: { score: 12, passed: true, passing_score: 12 },
  });
});
