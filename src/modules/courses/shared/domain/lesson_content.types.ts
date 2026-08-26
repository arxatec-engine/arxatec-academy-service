import type { LessonContentIssue, LessonPositionIssue } from '@/constants/courses';
import type { lesson_type, video_provider } from '@/generated/enums';

export interface LessonContentDraft {
  type: lesson_type;
  video_provider?: video_provider | null;
  video_external_id?: string | null;
  duration_seconds?: number | null;
  article_body?: string | null;
}

export interface LessonContent {
  video_provider: video_provider | null;
  video_external_id: string | null;
  duration_seconds: number | null;
  article_body: string | null;
  article_word_count: number | null;
  reading_minutes: number | null;
}

export type LessonContentResult =
  { valid: true; content: LessonContent } | { valid: false; issue: LessonContentIssue };

export interface LessonPosition {
  id: string;
  position: number;
}

export type LessonPositionResult = { valid: true } | { valid: false; issue: LessonPositionIssue };
