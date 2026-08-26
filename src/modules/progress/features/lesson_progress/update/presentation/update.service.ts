import { findPublishedLessonRefsByCourseIds } from '@/modules/courses/shared/data/course_refs.repository';
import type { UpdateLessonProgressPayload } from '@/modules/progress/features/lesson_progress/update/domain/update.payload';
import type { UpdateLessonProgressResult } from '@/modules/progress/features/lesson_progress/update/domain/update.types';
import {
  completeLesson,
  saveLessonProgress,
} from '@/modules/progress/shared/data/progress.repository';
import { requireMarkableLesson } from '@/modules/progress/shared/domain/markable_lesson';
import { toApiLessonProgress } from '@/modules/progress/shared/domain/progress_mapper';

export const updateLessonProgressService = async (
  payload: UpdateLessonProgressPayload,
): Promise<UpdateLessonProgressResult> => {
  const lesson = await requireMarkableLesson({
    lesson_id: payload.lesson_id,
    has_session: payload.has_session,
  });
  const progress = await saveLessonProgress({
    user_id: payload.user_id,
    lesson_id: lesson.id,
    last_position_seconds: payload.last_position_seconds,
  });

  if (!payload.completed) {
    return { progress: toApiLessonProgress(progress) };
  }

  const lessons = await findPublishedLessonRefsByCourseIds([lesson.course.id]);
  const completion = await completeLesson({
    user_id: payload.user_id,
    lesson_id: lesson.id,
    course_id: lesson.course.id,
    published_lesson_ids: lessons.map((published) => published.id),
    completed_at: new Date(),
  });

  return { progress: toApiLessonProgress(completion.progress) };
};
