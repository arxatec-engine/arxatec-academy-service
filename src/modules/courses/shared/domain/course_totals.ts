import { SecondsPerMinute } from '@/constants/courses';
import { lesson_type } from '@/generated/enums';
import type {
  CourseContentTotals,
  CourseLessonAggregate,
  CourseTotals,
  LessonSummaryRecord,
} from '@/modules/courses/shared/domain/course.types';

const EMPTY_TOTALS: CourseTotals = { lesson_count: 0, total_duration_seconds: 0 };

export const toTotalDurationSeconds = (duration_seconds: number, reading_minutes: number): number =>
  duration_seconds + reading_minutes * SecondsPerMinute;

export const toCourseTotals = (aggregate: CourseLessonAggregate | undefined): CourseTotals =>
  aggregate === undefined
    ? EMPTY_TOTALS
    : {
        lesson_count: aggregate.lesson_count,
        total_duration_seconds: toTotalDurationSeconds(
          aggregate.duration_seconds,
          aggregate.reading_minutes,
        ),
      };

export const summarizeLessons = (lessons: readonly LessonSummaryRecord[]): CourseContentTotals => ({
  lesson_count: lessons.length,
  video_count: lessons.filter((lesson) => lesson.type === lesson_type.VIDEO).length,
  article_count: lessons.filter((lesson) => lesson.type === lesson_type.ARTICLE).length,
  total_duration_seconds: toTotalDurationSeconds(
    lessons.reduce((total, lesson) => total + (lesson.duration_seconds ?? 0), 0),
    lessons.reduce((total, lesson) => total + (lesson.reading_minutes ?? 0), 0),
  ),
});
