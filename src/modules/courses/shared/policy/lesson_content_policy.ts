import { CoursePolicy, LessonContentIssues } from '@/constants/courses';
import { lesson_type } from '@/generated/enums';
import type {
  LessonContent,
  LessonContentDraft,
  LessonContentResult,
} from '@/modules/courses/shared/domain/lesson_content.types';

const HTML_TAG = /<[^>]*>/g;
const WHITESPACE = /\s+/;

const EMPTY_CONTENT: LessonContent = {
  video_provider: null,
  video_external_id: null,
  duration_seconds: null,
  article_body: null,
  article_word_count: null,
  reading_minutes: null,
};

const isPositiveInteger = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

export const countArticleWords = (article_body: string): number => {
  const text = article_body.replace(HTML_TAG, ' ').trim();

  return text.length === 0 ? 0 : text.split(WHITESPACE).length;
};

export const computeReadingMinutes = (word_count: number): number =>
  Math.max(1, Math.ceil(word_count / CoursePolicy.reading_words_per_minute));

const resolveVideoContent = (draft: LessonContentDraft): LessonContentResult => {
  const video_external_id = draft.video_external_id?.trim() ?? '';

  if (
    draft.video_provider === null ||
    draft.video_provider === undefined ||
    video_external_id.length === 0 ||
    !isPositiveInteger(draft.duration_seconds)
  ) {
    return { valid: false, issue: LessonContentIssues.video_fields_missing };
  }

  return {
    valid: true,
    content: {
      ...EMPTY_CONTENT,
      video_provider: draft.video_provider,
      video_external_id,
      duration_seconds: draft.duration_seconds,
    },
  };
};

const resolveArticleContent = (draft: LessonContentDraft): LessonContentResult => {
  const article_body = draft.article_body?.trim() ?? '';
  const article_word_count = countArticleWords(article_body);

  if (article_word_count === 0) {
    return { valid: false, issue: LessonContentIssues.article_body_missing };
  }

  return {
    valid: true,
    content: {
      ...EMPTY_CONTENT,
      article_body,
      article_word_count,
      reading_minutes: computeReadingMinutes(article_word_count),
    },
  };
};

export const resolveLessonContent = (draft: LessonContentDraft): LessonContentResult =>
  draft.type === lesson_type.VIDEO ? resolveVideoContent(draft) : resolveArticleContent(draft);
