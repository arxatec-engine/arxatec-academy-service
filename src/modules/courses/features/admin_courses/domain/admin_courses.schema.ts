import { z } from 'zod';

import { CoursePolicy } from '@/constants/courses';
import { ValidationKeys } from '@/constants/validation_keys';
import { course_level, course_topic } from '@/generated/enums';
import { teacherSchema } from '@/modules/courses/shared/domain/teacher.schema';

const title = z.string().trim()
  .min(1, ValidationKeys.courses.title_required)
  .max(CoursePolicy.title_max_length, ValidationKeys.courses.title_too_long);
const slug = z.string().trim()
  .min(1, ValidationKeys.courses.slug_required)
  .max(CoursePolicy.slug_max_length, ValidationKeys.courses.slug_too_long)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, ValidationKeys.courses.slug_required);
const short_description = z.string().trim()
  .max(CoursePolicy.short_description_max_length, ValidationKeys.courses.short_description_too_long);

export const adminCourseIdSchema = z.object({ id: z.string().min(1) });

export const createAdminCourseSchema = z.object({
  title,
  topic: z.enum(course_topic, ValidationKeys.courses.topic_invalid),
  level: z.enum(course_level, ValidationKeys.courses.level_invalid),
  short_description: short_description.default(''),
  long_description: z.string().trim().default(''),
});

export const updateAdminCourseSchema = z.object({
  expected_updated_at: z.iso.datetime({ message: ValidationKeys.courses.expected_updated_at_required }),
  title: title.optional(),
  slug: slug.optional(),
  short_description: short_description.optional(),
  long_description: z.string().trim().optional(),
  topic: z.enum(course_topic, ValidationKeys.courses.topic_invalid).optional(),
  level: z.enum(course_level, ValidationKeys.courses.level_invalid).optional(),
  catalog_order: z.number().int().positive().optional(),
  teacher: teacherSchema.nullable().optional(),
});

export const reorderAdminCoursesSchema = z.object({
  course_ids: z.array(z.string().min(1)).superRefine((ids, context) => {
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: 'custom', message: ValidationKeys.courses.course_ids_invalid });
    }
  }),
});
