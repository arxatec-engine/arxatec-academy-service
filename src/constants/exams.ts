export const ExamPolicy = {
  question_count: 15,
  option_count: 4,
  passing_score: 12,
  question_max_length: 1000,
  option_max_length: 300,
  submissions: { window_seconds: 60, max: 5 },
} as const;
