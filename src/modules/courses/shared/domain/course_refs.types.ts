import type { course_status, lesson_status } from '@/generated/enums';

export interface CourseRefRecord {
  id: string;
  slug: string;
  title: string;
}

export interface LessonRefRecord {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  position: number;
}

export interface LessonCourseRecord extends CourseRefRecord {
  status: course_status;
}

export interface LessonWithCourseRecord {
  id: string;
  slug: string;
  title: string;
  is_free_sample: boolean;
  status: lesson_status;
  course: LessonCourseRecord;
}
