import type { LessonRefRecord } from '@/modules/courses/shared/domain/course_refs.types';

export interface EnrollmentRecord {
  course_id: string;
  started_at: Date;
  completed_at: Date | null;
  last_lesson_id: string | null;
}

export interface LessonProgressRecord {
  lesson_id: string;
  completed_at: Date | null;
  last_position_seconds: number;
  updated_at: Date;
}

export interface CourseProgress {
  completed_lessons: number;
  lesson_count: number;
  next_lesson: LessonRefRecord | null;
  is_completed: boolean;
}

export interface ApiProgressCourse {
  slug: string;
  title: string;
}

export interface ApiNextLesson {
  slug: string;
  title: string;
}

export interface ApiEnrollment {
  course: ApiProgressCourse;
  started_at: string;
  completed_at: string | null;
  completed_lessons: number;
  lesson_count: number;
  next_lesson: ApiNextLesson | null;
}

export interface ApiLessonProgress {
  lesson_id: string;
  last_position_seconds: number;
  completed_at: string | null;
  updated_at: string;
}

export interface ApiLessonMark {
  lesson_id: string;
  completed_at: string | null;
  enrollment: ApiEnrollment | null;
}

export interface ApiMyCourseInProgress {
  course: ApiProgressCourse;
  completed_lessons: number;
  lesson_count: number;
  next_lesson: ApiNextLesson | null;
}

export interface ApiMyCourseCompleted {
  course: ApiProgressCourse;
  lesson_count: number;
  completed_at: string;
}
