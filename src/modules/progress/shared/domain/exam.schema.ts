import { z } from 'zod';
import { ExamPolicy } from '@/constants/exams';
import { ValidationKeys } from '@/constants/validation_keys';

const invalid = ValidationKeys.common.invalid;
export const examQuestionSchema = z.strictObject({
  text: z.string().trim().min(1, invalid).max(ExamPolicy.question_max_length, invalid),
  options: z
    .array(z.string().trim().min(1, invalid).max(ExamPolicy.option_max_length, invalid))
    .length(ExamPolicy.option_count, invalid)
    .refine(
      (options) => new Set(options.map((option) => option.toLowerCase())).size === options.length,
      invalid,
    ),
  correct_option: z
    .number()
    .int()
    .min(0, invalid)
    .max(ExamPolicy.option_count - 1, invalid),
});
export const examQuestionsSchema = z
  .array(examQuestionSchema)
  .length(ExamPolicy.question_count, invalid);
export const saveExamSchema = z.strictObject({
  expected_version: z.number().int().min(0, invalid),
  enabled: z.boolean(),
  passing_score: z.number().int().min(1, invalid).max(ExamPolicy.question_count, invalid),
  questions: examQuestionsSchema,
});
export const submitExamSchema = z.strictObject({
  version: z.number().int().min(1, invalid),
  answers: z
    .array(
      z
        .number()
        .int()
        .min(0, invalid)
        .max(ExamPolicy.option_count - 1, invalid),
    )
    .length(ExamPolicy.question_count, invalid),
});
export type ExamQuestion = z.infer<typeof examQuestionSchema>;
export type SaveExamInput = z.infer<typeof saveExamSchema>;
export type SubmitExamInput = z.infer<typeof submitExamSchema>;
