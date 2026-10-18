import { z } from 'zod';

import { NotificationPolicy } from '@/constants/notifications';
import { ValidationKeys } from '@/constants/validation_keys';
import { emailSchema } from '@/utils/email_schema';

export const createSignupSchema = z.object({
  email: emailSchema.optional(), course_slug: z.string().trim().min(1).optional(),
});
export const createTopicSchema = z.object({
  email: emailSchema.optional(),
  search_term: z.string()
    .refine((value) => [...value].every((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    }), ValidationKeys.common.invalid)
    .transform((value) => value.trim().replace(/\s+/g, ' '))
    .pipe(z.string().min(1).max(NotificationPolicy.search_term_max_length)),
});
export const signupFiltersSchema = z.object({
  course_id: z.string().min(1).optional(),
  notified: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
});
export const signupListSchema = signupFiltersSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(NotificationPolicy.max_page_size)
    .default(NotificationPolicy.default_page_size),
});
export const notifySignupsSchema = z.object({
  course_id: z.string().nullable(),
  signed_up_before: z.iso.datetime().transform((value) => new Date(value))
    .refine((date) => date.getTime() <= Date.now(), ValidationKeys.common.invalid),
});
export const deleteSubscriberSchema = z.object({ email: emailSchema });
