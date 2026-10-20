import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CommentMessages } from '@/constants/messages/comments';
import { comment_status, user_role } from '@/generated/enums';
import { replyCommentService } from '@/modules/comments/features/thread/reply/presentation/reply.service';
import { createComment } from '@/modules/comments/shared/data/comments.repository';
import type { CommentRecord } from '@/modules/comments/shared/domain/comment.types';
import { requireRootComment } from '@/modules/comments/shared/domain/comment_target';
import { AppError } from '@/utils/errors';

jest.mock('@/modules/comments/shared/data/comments.repository', () => ({
  createComment: jest.fn(),
}));

jest.mock('@/modules/comments/shared/domain/comment_target', () => ({
  requireRootComment: jest.fn(),
}));

const createCommentMock = jest.mocked(createComment);
const requireRootCommentMock = jest.mocked(requireRootComment);

const BODY = 'Sí, aplica igual.';

const CREATED: CommentRecord = {
  id: 'cmt_2',
  parent_id: 'cmt_1',
  body: BODY,
  created_at: new Date('2026-07-01T11:00:00.000Z'),
  user: {
    full_name: 'Admin Arxatec',
    avatar_url: null, avatar_key: null,
    organization: 'Arxatec',
    is_independent: false,
    role: user_role.ADMIN,
  },
};

const payload = { user_id: 'usr_admin', comment_id: 'cmt_1', body: BODY };

beforeEach(() => {
  requireRootCommentMock.mockResolvedValue({
    id: 'cmt_1',
    lesson_id: 'les_1',
    parent_id: null,
    status: comment_status.VISIBLE,
  });
  createCommentMock.mockResolvedValue(CREATED);
});

describe('replyCommentService', () => {
  it('la respuesta hereda la lección del padre: no la manda el cliente', async () => {
    await replyCommentService(payload);

    expect(createCommentMock).toHaveBeenCalledWith({
      lesson_id: 'les_1',
      user_id: 'usr_admin',
      parent_id: 'cmt_1',
      body: BODY,
    });
  });

  it('la respuesta de un ADMIN sale con la insignia del equipo', async () => {
    const result = await replyCommentService(payload);

    expect(result.comment.author?.is_team).toBe(true);
    expect(result.comment.parent_id).toBe('cmt_1');
  });

  it('responder a una respuesta propaga el 422 y no escribe nada', async () => {
    requireRootCommentMock.mockRejectedValue(
      new AppError(
        CommentMessages.thread.reply_not_allowed,
        HttpStatusCodes.UNPROCESSABLE_ENTITY.code,
        { code: ErrorCodes.VALIDATION_ERROR },
      ),
    );

    await expect(replyCommentService(payload)).rejects.toMatchObject({
      statusCode: HttpStatusCodes.UNPROCESSABLE_ENTITY.code,
      meta: { code: ErrorCodes.VALIDATION_ERROR },
    });
    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it('responder a un comentario inexistente propaga el 404', async () => {
    requireRootCommentMock.mockRejectedValue(
      new AppError(CommentMessages.thread.not_found, HttpStatusCodes.NOT_FOUND.code, {
        code: ErrorCodes.NOT_FOUND,
      }),
    );

    await expect(replyCommentService(payload)).rejects.toMatchObject({
      statusCode: HttpStatusCodes.NOT_FOUND.code,
    });
    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it('el JSON del resultado no contiene ninguna arroba', async () => {
    expect(JSON.stringify(await replyCommentService(payload))).not.toContain('@');
  });
});
