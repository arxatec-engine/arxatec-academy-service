import { resolveStoredFileUrl } from '@/infrastructure/storage/file_url';
import type { GetCommentsPayload } from '@/modules/comments/features/thread/get_list/domain/get_list.payload';
import type { GetCommentsResult } from '@/modules/comments/features/thread/get_list/domain/get_list.types';
import { findVisibleCommentsByLesson } from '@/modules/comments/shared/data/comments.repository';
import { buildThreads } from '@/modules/comments/shared/domain/comment_thread';
import { requireCommentableLesson } from '@/modules/comments/shared/domain/commentable_lesson';

export const getCommentsService = async (
  payload: GetCommentsPayload,
): Promise<GetCommentsResult> => {
  const lesson = await requireCommentableLesson(payload.lesson_id);
  const comments = await findVisibleCommentsByLesson(lesson.id);

  return { comments: buildThreads(comments, resolveStoredFileUrl) };
};
