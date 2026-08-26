import { CoursePolicy, LessonPositionIssues } from '@/constants/courses';
import type {
  LessonPosition,
  LessonPositionResult,
} from '@/modules/courses/shared/domain/lesson_content.types';

export const resequenceLessonPositions = (
  ordered_lesson_ids: readonly string[],
): readonly LessonPosition[] =>
  ordered_lesson_ids.map((id, index) => ({ id, position: CoursePolicy.first_position + index }));

export const validateLessonPositions = (positions: readonly number[]): LessonPositionResult => {
  if (new Set(positions).size !== positions.length) {
    return { valid: false, issue: LessonPositionIssues.duplicated };
  }

  const sorted = [...positions].sort((left, right) => left - right);
  const contiguous = sorted.every(
    (position, index) => position === CoursePolicy.first_position + index,
  );

  return contiguous
    ? { valid: true }
    : { valid: false, issue: LessonPositionIssues.not_contiguous };
};
