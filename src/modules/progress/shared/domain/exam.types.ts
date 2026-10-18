import type { ExamQuestion } from './exam.schema';

export interface AdminExam {
  version: number;
  enabled: boolean;
  passing_score: number;
  questions: ExamQuestion[];
  updated_at: string;
}
export interface ExamResult {
  score: number | null;
  passed: boolean;
  passing_score: number;
  question_count: number;
  certificate_id: string | null;
}
export interface CourseExamView {
  course: { slug: string; title: string };
  status: 'unavailable' | 'locked' | 'ready' | 'passed';
  version: number | null;
  question_count: number;
  passing_score: number;
  questions: Omit<ExamQuestion, 'correct_option'>[];
  certificate_id: string | null;
  last_result: ExamResult | null;
}
