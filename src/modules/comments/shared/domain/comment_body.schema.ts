import { z } from 'zod';

import { CommentPolicy } from '@/constants/comments';
import { ValidationKeys } from '@/constants/validation_keys';

export const commentBodySchema = z.string(ValidationKeys.comments.body_required).trim()
  .min(CommentPolicy.body_min_length, ValidationKeys.comments.body_required)
  .max(CommentPolicy.body_max_length, ValidationKeys.comments.body_too_long);
