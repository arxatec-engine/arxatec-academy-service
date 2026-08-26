import { CoursePolicy } from '@/constants/courses';

export interface CoursePublicationInput {
  published_lesson_count: number;
}

export const canPublishCourse = ({ published_lesson_count }: CoursePublicationInput): boolean =>
  published_lesson_count >= CoursePolicy.min_published_lessons_to_publish;
