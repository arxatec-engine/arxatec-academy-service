import {
  findPublishedCoursesByIds,
  findPublishedLessonRefsByCourseIds,
} from '@/modules/courses/shared/data/course_refs.repository';
import type { CourseRefRecord } from '@/modules/courses/shared/domain/course_refs.types';
import type { GetMyCoursesPayload } from '@/modules/progress/features/my_courses/get_list/domain/get_list.payload';
import type { GetMyCoursesResult } from '@/modules/progress/features/my_courses/get_list/domain/get_list.types';
import {
  findCompletedLessonIds,
  findEnrollmentsByUser,
} from '@/modules/progress/shared/data/progress.repository';
import {
  groupLessonsByCourse,
  summarizeCourseProgress,
} from '@/modules/progress/shared/domain/course_progress';
import { isEnrollmentFinished } from '@/modules/progress/shared/policy/completion';
import type {
  ApiMyCourseCompleted,
  ApiMyCourseInProgress,
} from '@/modules/progress/shared/domain/progress.types';
import {
  toApiMyCourseCompleted,
  toApiMyCourseInProgress,
} from '@/modules/progress/shared/domain/progress_mapper';

interface CompletedEntry {
  completed_at: Date;
  course: ApiMyCourseCompleted;
}

const EMPTY_RESULT: GetMyCoursesResult = { in_progress: [], completed: [] };

export const getMyCoursesService = async (
  payload: GetMyCoursesPayload,
): Promise<GetMyCoursesResult> => {
  const enrollments = await findEnrollmentsByUser(payload.user_id);

  if (enrollments.length === 0) {
    return EMPTY_RESULT;
  }

  const courses = await findPublishedCoursesByIds(
    enrollments.map((enrollment) => enrollment.course_id),
  );
  const courses_by_id = new Map<string, CourseRefRecord>(
    courses.map((course) => [course.id, course]),
  );
  const lessons = await findPublishedLessonRefsByCourseIds(courses.map((course) => course.id));
  const lessons_by_course = groupLessonsByCourse(lessons);
  const completed_lesson_ids = await findCompletedLessonIds(
    payload.user_id,
    lessons.map((lesson) => lesson.id),
  );

  const in_progress: ApiMyCourseInProgress[] = [];
  const completed: CompletedEntry[] = [];

  for (const enrollment of enrollments) {
    const course = courses_by_id.get(enrollment.course_id);

    if (course === undefined) {
      continue;
    }

    const progress = summarizeCourseProgress({
      lessons: lessons_by_course.get(course.id) ?? [],
      completed_lesson_ids,
    });

    if (isEnrollmentFinished(enrollment, progress.is_completed)) {
      completed.push({
        completed_at: enrollment.completed_at,
        course: toApiMyCourseCompleted(
          course,
          progress,
          enrollment.completed_at,
          enrollment.certificate?.id ?? null,
        ),
      });

      continue;
    }

    in_progress.push(toApiMyCourseInProgress(course, progress, enrollment.certificate?.id ?? null));
  }

  return {
    in_progress,
    completed: completed
      .sort((left, right) => right.completed_at.getTime() - left.completed_at.getTime())
      .map((entry) => entry.course),
  };
};
