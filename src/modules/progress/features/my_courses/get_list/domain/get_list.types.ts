import type {
  ApiMyCourseCompleted,
  ApiMyCourseInProgress,
} from '@/modules/progress/shared/domain/progress.types';

export interface GetMyCoursesResult {
  in_progress: readonly ApiMyCourseInProgress[];
  completed: readonly ApiMyCourseCompleted[];
}
