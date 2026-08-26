import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CommentMessages } from '@/constants/messages/comments';
import { comment_status } from '@/generated/enums';
import { createCommentReportService } from '@/modules/comments/features/report/create/presentation/create.service';
import { createCommentReport } from '@/modules/comments/shared/data/comments.repository';
import { requireComment } from '@/modules/comments/shared/domain/comment_target';
import { AppError } from '@/utils/errors';

jest.mock('@/modules/comments/shared/data/comments.repository', () => ({
  createCommentReport: jest.fn(),
}));

jest.mock('@/modules/comments/shared/domain/comment_target', () => ({
  requireComment: jest.fn(),
}));

const createCommentReportMock = jest.mocked(createCommentReport);
const requireCommentMock = jest.mocked(requireComment);

const payload = { user_id: 'usr_1', comment_id: 'cmt_1', reason: null };

beforeEach(() => {
  requireCommentMock.mockResolvedValue({
    id: 'cmt_1',
    lesson_id: 'les_1',
    parent_id: null,
    status: comment_status.VISIBLE,
  });
  createCommentReportMock.mockResolvedValue(undefined);
});

describe('createCommentReportService', () => {
  it('guarda el reporte con el usuario de la sesión', async () => {
    await createCommentReportService(payload);

    expect(createCommentReportMock).toHaveBeenCalledWith({
      comment_id: 'cmt_1',
      reported_by_user_id: 'usr_1',
      reason: null,
    });
  });

  it('el motivo opcional viaja tal cual cuando llega', async () => {
    await createCommentReportService({ ...payload, reason: 'Es publicidad' });

    expect(createCommentReportMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'Es publicidad' }),
    );
  });

  it('no devuelve nada: la respuesta no dice si ya lo habías reportado', async () => {
    await expect(createCommentReportService(payload)).resolves.toBeUndefined();
  });

  it('reportar dos veces vuelve a escribir: la idempotencia la pone el índice único', async () => {
    await createCommentReportService(payload);
    await createCommentReportService(payload);

    expect(createCommentReportMock).toHaveBeenCalledTimes(2);
  });

  it('un comentario inexistente propaga el 404 y no escribe el reporte', async () => {
    requireCommentMock.mockRejectedValue(
      new AppError(CommentMessages.thread.not_found, HttpStatusCodes.NOT_FOUND.code, {
        code: ErrorCodes.NOT_FOUND,
      }),
    );

    await expect(createCommentReportService(payload)).rejects.toMatchObject({
      statusCode: HttpStatusCodes.NOT_FOUND.code,
    });
    expect(createCommentReportMock).not.toHaveBeenCalled();
  });
});
