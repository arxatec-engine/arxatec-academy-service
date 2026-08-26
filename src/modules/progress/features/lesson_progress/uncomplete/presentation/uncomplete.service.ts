import { findPublishedLessonRefsByCourseIds } from '@/modules/courses/shared/data/course_refs.repository';
import type { UncompleteLessonPayload } from '@/modules/progress/features/lesson_progress/uncomplete/domain/uncomplete.payload';
import type { UncompleteLessonResult } from '@/modules/progress/features/lesson_progress/uncomplete/domain/uncomplete.types';
import {
  findCompletedLessonIds,
  uncompleteLesson,
} from '@/modules/progress/shared/data/progress.repository';
import { summarizeCourseProgress } from '@/modules/progress/shared/domain/course_progress';
import { requireMarkableLesson } from '@/modules/progress/shared/domain/markable_lesson';
import { toApiEnrollment } from '@/modules/progress/shared/domain/progress_mapper';

export const uncompleteLessonService = async (
  payload: UncompleteLessonPayload,
): Promise<UncompleteLessonResult> => {
  const lesson = await requireMarkableLesson({
    lesson_id: payload.lesson_id,
    has_session: payload.has_session,
  });
  const enrollment = await uncompleteLesson({
    user_id: payload.user_id,
    lesson_id: lesson.id,
    course_id: lesson.course.id,
  });
  const lessons = await findPublishedLessonRefsByCourseIds([lesson.course.id]);
  const completed_lesson_ids = await findCompletedLessonIds(
    payload.user_id,
    lessons.map((published) => published.id),
  );

  return {
    mark: {
      lesson_id: lesson.id,
      completed_at: null,
      enrollment:
        enrollment === null
          ? null
          : toApiEnrollment(
              lesson.course,
              enrollment,
              summarizeCourseProgress({ lessons, completed_lesson_ids }),
            ),
    },
  };
};
