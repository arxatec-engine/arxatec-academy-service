import type {
  ApiLessonNavigation,
  ApiLessonNavigationStep,
} from '@/modules/courses/features/lessons/get_detail/domain/get_detail.types';

interface LessonNavigationCandidate {
  slug: string;
  title: string;
}

const toStep = ({ slug, title }: LessonNavigationCandidate): ApiLessonNavigationStep => ({
  slug,
  title,
});

export const resolveLessonNavigation = (
  lessons: readonly LessonNavigationCandidate[],
  index: number,
): ApiLessonNavigation => ({
  previous: index > 0 && index < lessons.length ? toStep(lessons[index - 1]) : null,
  next: index >= 0 && index < lessons.length - 1 ? toStep(lessons[index + 1]) : null,
});
