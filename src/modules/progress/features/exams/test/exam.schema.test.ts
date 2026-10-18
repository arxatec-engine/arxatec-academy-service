import { saveExamSchema, submitExamSchema } from '@/modules/progress/shared/domain/exam.schema';
import { gradeExam } from '@/modules/progress/shared/policy/grade_exam';

const questions = Array.from({ length: 15 }, (_, index) => ({
  text: `Pregunta ${index + 1}`,
  options: ['Primera', 'Segunda', 'Tercera', 'Cuarta'],
  correct_option: index % 4,
}));
const input = { expected_version: 0, enabled: true, passing_score: 12, questions };

describe('contrato del examen', () => {
  it('requiere exactamente 15 preguntas y cuatro opciones distintas', () => {
    expect(saveExamSchema.safeParse(input).success).toBe(true);
    for (const count of [0, 14, 16]) {
      expect(
        saveExamSchema.safeParse({
          ...input,
          questions: Array.from({ length: count }, () => questions[0]),
        }).success,
      ).toBe(false);
    }
    for (const options of [
      ['A', 'B', 'C'],
      ['A', 'B', 'C', 'D', 'E'],
      ['A', 'a', 'B', 'C'],
      ['A', ' ', 'B', 'C'],
    ]) {
      expect(
        saveExamSchema.safeParse({
          ...input,
          questions: [{ ...questions[0], options }, ...questions.slice(1)],
        }).success,
      ).toBe(false);
    }
  });
  it.each([-1, 4, 1.5])(
    'rechaza la respuesta correcta fuera de las opciones: %s',
    (correct_option) => {
      expect(
        saveExamSchema.safeParse({
          ...input,
          questions: [{ ...questions[0], correct_option }, ...questions.slice(1)],
        }).success,
      ).toBe(false);
    },
  );
  it.each([0, 16, 12.5])('rechaza la nota mínima inválida: %s', (passing_score) => {
    expect(saveExamSchema.safeParse({ ...input, passing_score }).success).toBe(false);
  });
  it('rechaza intentos incompletos, notas enviadas por el cliente e índices inválidos', () => {
    const valid = { version: 1, answers: Array.from({ length: 15 }, () => 0) };
    expect(submitExamSchema.safeParse(valid).success).toBe(true);
    expect(submitExamSchema.safeParse({ ...valid, score: 15, passed: true }).success).toBe(false);
    for (const answers of [
      valid.answers.slice(1),
      [...valid.answers, 0],
      [...valid.answers.slice(1), 4],
      [...valid.answers.slice(1), -1],
    ]) {
      expect(submitExamSchema.safeParse({ ...valid, answers }).success).toBe(false);
    }
  });
});

describe('corrección del examen', () => {
  it.each([0, 11, 12, 15])('calcula %s aciertos con una nota mínima de 12', (score) => {
    const answers = questions.map((question, index) =>
      index < score ? question.correct_option : (question.correct_option + 1) % 4,
    );
    expect(gradeExam(questions, answers, 12)).toEqual({ score, passed: score >= 12 });
  });
});
