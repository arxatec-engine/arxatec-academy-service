import { z } from 'zod';

import { CoursePolicy } from '@/constants/courses';
import { ValidationKeys } from '@/constants/validation_keys';
import { lesson_type, video_provider } from '@/generated/enums';

const title = z.string().trim().min(1, ValidationKeys.courses.title_required)
  .max(CoursePolicy.lesson_title_max_length, ValidationKeys.courses.title_too_long);
const slug = z.string().trim().min(1, ValidationKeys.courses.slug_required)
  .max(CoursePolicy.lesson_slug_max_length, ValidationKeys.courses.slug_too_long)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, ValidationKeys.courses.slug_required);

export const lessonIdSchema = z.object({ id: z.string().min(1) });
export const courseIdSchema = z.object({ course_id: z.string().min(1) });
export const lessonResourceIdSchema = z.object({ lesson_id: z.string().min(1), id: z.string().min(1) });
export const createAdminLessonSchema = z.object({ title, type: z.enum(lesson_type) });
export const updateAdminLessonSchema = z.object({
  title: title.optional(), slug: slug.optional(), description: z.string().trim().optional(),
  type: z.enum(lesson_type).optional(), is_free_sample: z.boolean().optional(),
  video_provider: z.enum(video_provider).nullable().optional(),
  video_external_id: z.string().trim().max(CoursePolicy.video_external_id_max_length).nullable().optional(),
  duration_seconds: z.number().int().positive().max(2147483647).optional(),
  article_body: z.string().nullable().optional(), transcript: z.string().nullable().optional(),
  confirm_type_change: z.boolean().optional(),
});
export const deleteAdminLessonSchema = z.object({ confirm_destroys_student_data: z.boolean().optional() });
export const reorderLessonsSchema = z.object({ lesson_ids: z.array(z.string().min(1)) });
export const resourceTitleSchema = z.object({ title: title });
export const reorderResourcesSchema = z.object({ resource_ids: z.array(z.string().min(1)) });
export const probeVideoSchema = z.object({
  provider: z.enum(video_provider),
  external_id: z.string().max(CoursePolicy.video_external_id_max_length),
}).refine(({ provider, external_id }) => provider === video_provider.YOUTUBE
  ? /^[A-Za-z0-9_-]{11}$/.test(external_id) : /^\d+$/.test(external_id),
{ path: ['external_id'] });
