import type {
  ApiCourseDetail,
  ApiLessonSummary,
} from '@/modules/courses/shared/domain/course.types';

export interface GetDetailResult {
  course: ApiCourseDetail;
  lessons: readonly ApiLessonSummary[];
}
