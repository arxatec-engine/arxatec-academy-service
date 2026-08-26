import type {
  CourseRefRecord,
  LessonRefRecord,
} from '@/modules/courses/shared/domain/course_refs.types';
import type {
  ApiEnrollment,
  ApiLessonProgress,
  ApiMyCourseCompleted,
  ApiMyCourseInProgress,
  ApiNextLesson,
  ApiProgressCourse,
  CourseProgress,
  EnrollmentRecord,
  LessonProgressRecord,
} from '@/modules/progress/shared/domain/progress.types';

export const toApiProgressCourse = (course: CourseRefRecord): ApiProgressCourse => ({
  slug: course.slug,
  title: course.title,
});

export const toApiNextLesson = (lesson: LessonRefRecord | null): ApiNextLesson | null =>
  lesson === null ? null : { slug: lesson.slug, title: lesson.title };

export const toApiEnrollment = (
  course: CourseRefRecord,
  enrollment: EnrollmentRecord,
  progress: CourseProgress,
): ApiEnrollment => ({
  course: toApiProgressCourse(course),
  started_at: enrollment.started_at.toISOString(),
  completed_at: enrollment.completed_at === null ? null : enrollment.completed_at.toISOString(),
  completed_lessons: progress.completed_lessons,
  lesson_count: progress.lesson_count,
  next_lesson: toApiNextLesson(progress.next_lesson),
});

export const toApiLessonProgress = (progress: LessonProgressRecord): ApiLessonProgress => ({
  lesson_id: progress.lesson_id,
  last_position_seconds: progress.last_position_seconds,
  completed_at: progress.completed_at === null ? null : progress.completed_at.toISOString(),
  updated_at: progress.updated_at.toISOString(),
});

export const toApiMyCourseInProgress = (
  course: CourseRefRecord,
  progress: CourseProgress,
): ApiMyCourseInProgress => ({
  course: toApiProgressCourse(course),
  completed_lessons: progress.completed_lessons,
  lesson_count: progress.lesson_count,
  next_lesson: toApiNextLesson(progress.next_lesson),
});

export const toApiMyCourseCompleted = (
  course: CourseRefRecord,
  progress: CourseProgress,
  completed_at: Date,
): ApiMyCourseCompleted => ({
  course: toApiProgressCourse(course),
  lesson_count: progress.lesson_count,
  completed_at: completed_at.toISOString(),
});
