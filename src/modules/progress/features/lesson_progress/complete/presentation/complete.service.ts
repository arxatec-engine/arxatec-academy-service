import { findPublishedLessonRefsByCourseIds } from '@/modules/courses/shared/data/course_refs.repository';
import type { CompleteLessonPayload } from '@/modules/progress/features/lesson_progress/complete/domain/complete.payload';
import type { CompleteLessonResult } from '@/modules/progress/features/lesson_progress/complete/domain/complete.types';
import {
  completeLesson,
  findCompletedLessonIds,
} from '@/modules/progress/shared/data/progress.repository';
import { summarizeCourseProgress } from '@/modules/progress/shared/domain/course_progress';
import { requireMarkableLesson } from '@/modules/progress/shared/domain/markable_lesson';
import { toApiEnrollment } from '@/modules/progress/shared/domain/progress_mapper';

export const completeLessonService = async (
  payload: CompleteLessonPayload,
): Promise<CompleteLessonResult> => {
  const lesson = await requireMarkableLesson({
    lesson_id: payload.lesson_id,
    has_session: payload.has_session,
  });
  const lessons = await findPublishedLessonRefsByCourseIds([lesson.course.id]);
  const completion = await completeLesson({
    user_id: payload.user_id,
    lesson_id: lesson.id,
    course_id: lesson.course.id,
    published_lesson_ids: lessons.map((published) => published.id),
    completed_at: new Date(),
  });
  const completed_lesson_ids = await findCompletedLessonIds(
    payload.user_id,
    lessons.map((published) => published.id),
  );

  return {
    mark: {
      lesson_id: lesson.id,
      completed_at:
        completion.progress.completed_at === null
          ? null
          : completion.progress.completed_at.toISOString(),
      enrollment: toApiEnrollment(
        lesson.course,
        completion.enrollment,
        summarizeCourseProgress({ lessons, completed_lesson_ids }),
      ),
    },
  };
};
