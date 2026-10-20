import type { Prisma } from '@/generated/client';
import { ExamPolicy } from '@/constants/exams';
import { examQuestionsSchema } from '@/modules/progress/shared/domain/exam.schema';
import { gradeExam } from '@/modules/progress/shared/policy/grade_exam';
import { buildSeedCourses } from '@/seed/seed_courses';
import { buildSeedExams, seedExams } from '@/seed/seed_exams';

describe('exámenes de semilla', () => {
  it('incluye un examen válido y habilitado para cada curso de ejemplo', () => {
    const exams = buildSeedExams();
    expect(exams.map((exam) => exam.course_slug)).toEqual(
      buildSeedCourses().map((course) => course.slug),
    );
    for (const exam of exams) {
      expect(exam.enabled).toBe(true);
      expect(exam.passing_score).toBe(ExamPolicy.passing_score);
      expect(examQuestionsSchema.safeParse(exam.questions).success).toBe(true);
      expect(new Set(exam.questions.map((question) => question.text)).size).toBe(
        ExamPolicy.question_count,
      );
      expect(new Set(exam.questions.map((question) => question.correct_option)).size).toBe(
        ExamPolicy.option_count,
      );
    }
  });

  it('las respuestas de la semilla aprueban y las incorrectas no conceden certificado', () => {
    for (const exam of buildSeedExams()) {
      const correct = exam.questions.map((question) => question.correct_option);
      expect(gradeExam(exam.questions, correct, exam.passing_score)).toEqual({
        score: ExamPolicy.question_count,
        passed: true,
      });
      const incorrect = correct.map((option) => (option + 1) % ExamPolicy.option_count);
      expect(gradeExam(exam.questions, incorrect, exam.passing_score)).toEqual({
        score: 0,
        passed: false,
      });
    }
  });

  it('solo crea exámenes para los cursos de ejemplo presentes y conserva configuraciones existentes', async () => {
    const createMany = jest
      .fn<
        Promise<{ count: number }>,
        [{ data: Prisma.course_examsCreateManyInput[]; skipDuplicates: true }]
      >()
      .mockResolvedValue({ count: 1 });
    const definitions = buildSeedExams();
    const courses = [
      { id: 'course-1', slug: definitions[0].course_slug },
      { id: 'custom-course', slug: 'curso-personalizado' },
    ];
    const result = await seedExams({ course_exams: { createMany } }, courses);
    expect(result).toEqual({ created: 1, preserved: 0, missing_courses: definitions.length - 1 });
    expect(createMany).toHaveBeenCalledWith({
      skipDuplicates: true,
      data: [
        {
          course_id: 'course-1',
          enabled: true,
          passing_score: definitions[0].passing_score,
          questions: definitions[0].questions,
        },
      ],
    });
    createMany.mockResolvedValue({ count: 0 });
    await expect(seedExams({ course_exams: { createMany } }, courses)).resolves.toMatchObject({
      created: 0,
      preserved: 1,
    });
  });
});
