import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CommentMessages } from '@/constants/messages/comments';
import { comment_status } from '@/generated/enums';
import { findCommentRefById } from '@/modules/comments/shared/data/comments.repository';
import type { CommentRefRecord } from '@/modules/comments/shared/domain/comment.types';
import {
  requireComment,
  requireRootComment,
} from '@/modules/comments/shared/domain/comment_target';

jest.mock('@/modules/comments/shared/data/comments.repository', () => ({
  findCommentRefById: jest.fn(),
}));

const findCommentRefByIdMock = jest.mocked(findCommentRefById);

const ref = (overrides: Partial<CommentRefRecord> = {}): CommentRefRecord => ({
  id: 'cmt_1',
  lesson_id: 'les_1',
  parent_id: null,
  status: comment_status.VISIBLE,
  ...overrides,
});

beforeEach(() => {
  findCommentRefByIdMock.mockResolvedValue(ref());
});

describe('requireComment', () => {
  it('devuelve el comentario cuando existe', async () => {
    await expect(requireComment('cmt_1')).resolves.toEqual(ref());
  });

  it('un comentario inexistente responde 404 NOT_FOUND', async () => {
    findCommentRefByIdMock.mockResolvedValue(null);

    await expect(requireComment('cmt_1')).rejects.toMatchObject({
      statusCode: HttpStatusCodes.NOT_FOUND.code,
      message: CommentMessages.thread.not_found,
      meta: { code: ErrorCodes.NOT_FOUND },
    });
  });

  it('reportar no mira el estado: un HIDDEN se puede seguir reportando', async () => {
    findCommentRefByIdMock.mockResolvedValue(ref({ status: comment_status.HIDDEN }));

    await expect(requireComment('cmt_1')).resolves.toMatchObject({
      status: comment_status.HIDDEN,
    });
  });
});

describe('requireRootComment', () => {
  it('un comentario raíz visible se puede responder', async () => {
    await expect(requireRootComment('cmt_1')).resolves.toEqual(ref());
  });

  it('responder a una respuesta responde 422 VALIDATION_ERROR, no 404', async () => {
    findCommentRefByIdMock.mockResolvedValue(ref({ id: 'cmt_2', parent_id: 'cmt_1' }));

    await expect(requireRootComment('cmt_2')).rejects.toMatchObject({
      statusCode: HttpStatusCodes.UNPROCESSABLE_ENTITY.code,
      message: CommentMessages.thread.reply_not_allowed,
      meta: { code: ErrorCodes.VALIDATION_ERROR },
    });
  });

  it('responder a un comentario oculto responde 404: para el público no existe', async () => {
    findCommentRefByIdMock.mockResolvedValue(ref({ status: comment_status.HIDDEN }));

    await expect(requireRootComment('cmt_1')).rejects.toMatchObject({
      statusCode: HttpStatusCodes.NOT_FOUND.code,
      meta: { code: ErrorCodes.NOT_FOUND },
    });
  });

  it('responder a un comentario borrado responde 404', async () => {
    findCommentRefByIdMock.mockResolvedValue(ref({ status: comment_status.DELETED }));

    await expect(requireRootComment('cmt_1')).rejects.toMatchObject({
      statusCode: HttpStatusCodes.NOT_FOUND.code,
    });
  });

  it('un comentario inexistente responde 404', async () => {
    findCommentRefByIdMock.mockResolvedValue(null);

    await expect(requireRootComment('cmt_1')).rejects.toMatchObject({
      statusCode: HttpStatusCodes.NOT_FOUND.code,
    });
  });
});
