import type { ApiLessonSummary } from '@/modules/courses/shared/domain/course.types';
import type {
  ApiLessonCourse,
  ApiLessonLocked,
  ApiLessonUnlocked,
} from '@/modules/courses/shared/domain/lesson.types';

export interface ApiLessonNavigationStep {
  slug: string;
  title: string;
}

export interface ApiLessonNavigation {
  previous: ApiLessonNavigationStep | null;
  next: ApiLessonNavigationStep | null;
}

export interface UnlockedLessonView {
  lesson: ApiLessonUnlocked;
  course: ApiLessonCourse;
  navigation: ApiLessonNavigation;
}

export interface LockedLessonView {
  lesson: ApiLessonLocked;
  course: ApiLessonCourse;
  lessons: readonly ApiLessonSummary[];
}

export type GetDetailResult =
  { locked: false; view: UnlockedLessonView } | { locked: true; view: LockedLessonView };
