import { CoursePolicy } from '@/constants/courses';

export const readingTime = (article_body: string): { article_word_count: number; reading_minutes: number } => {
  const text = article_body.replace(/<[^>]*>/g, ' ').trim();
  const article_word_count = text.length === 0 ? 0 : text.split(/\s+/).length;
  return {
    article_word_count,
    reading_minutes: article_word_count === 0 ? 0
      : Math.max(1, Math.round(article_word_count / CoursePolicy.reading_words_per_minute)),
  };
};
