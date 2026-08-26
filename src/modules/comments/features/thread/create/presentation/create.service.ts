import type { CreateCommentPayload } from '@/modules/comments/features/thread/create/domain/create.payload';
import type { CreateCommentResult } from '@/modules/comments/features/thread/create/domain/create.types';
import { createComment } from '@/modules/comments/shared/data/comments.repository';
import { toApiComment } from '@/modules/comments/shared/domain/comment_mapper';
import { requireCommentableLesson } from '@/modules/comments/shared/domain/commentable_lesson';

export const createCommentService = async (
  payload: CreateCommentPayload,
): Promise<CreateCommentResult> => {
  const lesson = await requireCommentableLesson(payload.lesson_id);
  const comment = await createComment({
    lesson_id: lesson.id,
    user_id: payload.user_id,
    parent_id: null,
    body: payload.body,
  });

  return { comment: toApiComment(comment) };
};
