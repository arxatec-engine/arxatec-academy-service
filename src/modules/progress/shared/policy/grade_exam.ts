import type { ExamQuestion } from '@/modules/progress/shared/domain/exam.schema';

export const gradeExam = (
  questions: readonly ExamQuestion[],
  answers: readonly number[],
  passing_score: number,
): { score: number; passed: boolean } => {
  const score = questions.reduce(
    (total, question, index) => total + Number(answers[index] === question.correct_option),
    0,
  );
  return { score, passed: score >= passing_score };
};
