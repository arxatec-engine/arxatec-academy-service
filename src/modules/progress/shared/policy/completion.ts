export interface CourseCompletionInput {
  published_lesson_count: number;
  completed_lesson_count: number;
}

export const isCourseCompleted = ({
  published_lesson_count,
  completed_lesson_count,
}: CourseCompletionInput): boolean =>
  published_lesson_count > 0 && completed_lesson_count >= published_lesson_count;

export const isEnrollmentFinished = <T extends { completed_at: Date | null }>(
  enrollment: T,
  course_completed: boolean,
): enrollment is T & { completed_at: Date } =>
  course_completed && enrollment.completed_at !== null;
