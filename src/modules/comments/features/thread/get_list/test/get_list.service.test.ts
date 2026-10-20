import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CommentMessages } from '@/constants/messages/comments';
import { user_role } from '@/generated/enums';
import { getCommentsService } from '@/modules/comments/features/thread/get_list/presentation/get_list.service';
import { findVisibleCommentsByLesson } from '@/modules/comments/shared/data/comments.repository';
import type { CommentRecord } from '@/modules/comments/shared/domain/comment.types';
import { requireCommentableLesson } from '@/modules/comments/shared/domain/commentable_lesson';
import { AppError } from '@/utils/errors';
import { ErrorCodes } from '@/constants/error_codes';

jest.mock('@/modules/comments/shared/data/comments.repository', () => ({
  findVisibleCommentsByLesson: jest.fn(),
}));

jest.mock('@/modules/comments/shared/domain/commentable_lesson', () => ({
  requireCommentableLesson: jest.fn(),
}));

const findVisibleCommentsByLessonMock = jest.mocked(findVisibleCommentsByLesson);
const requireCommentableLessonMock = jest.mocked(requireCommentableLesson);

const ROOT: CommentRecord = {
  id: 'cmt_1',
  parent_id: null,
  body: '¿Esto aplica a un estudio de dos personas?',
  created_at: new Date('2026-07-01T10:00:00.000Z'),
  user: {
    full_name: 'Jorge Ramírez',
    avatar_url: null, avatar_key: null,
    organization: 'Estudio Ramírez Abogados',
    is_independent: false,
    role: user_role.STUDENT,
  },
};

const REPLY: CommentRecord = {
  id: 'cmt_2',
  parent_id: 'cmt_1',
  body: 'Sí, aplica igual.',
  created_at: new Date('2026-07-01T11:00:00.000Z'),
  user: {
    full_name: 'Admin Arxatec',
    avatar_url: null, avatar_key: null,
    organization: 'Arxatec',
    is_independent: false,
    role: user_role.ADMIN,
  },
};

beforeEach(() => {
  requireCommentableLessonMock.mockResolvedValue({ id: 'les_1' });
  findVisibleCommentsByLessonMock.mockResolvedValue([ROOT, REPLY]);
});

describe('getCommentsService', () => {
  it('devuelve los hilos de un nivel con el autor reducido', async () => {
    const result = await getCommentsService({ lesson_id: 'les_1' });

    expect(result).toEqual({
      comments: [
        {
          id: 'cmt_1',
          parent_id: null,
          body: '¿Esto aplica a un estudio de dos personas?',
          created_at: '2026-07-01T10:00:00.000Z',
          author: {
            full_name: 'Jorge Ramírez',
            avatar_url: null,
            affiliation: 'Estudio Ramírez Abogados',
            is_team: false,
          },
          replies: [
            {
              id: 'cmt_2',
              parent_id: 'cmt_1',
              body: 'Sí, aplica igual.',
              created_at: '2026-07-01T11:00:00.000Z',
              author: {
                full_name: 'Admin Arxatec',
                avatar_url: null,
                affiliation: 'Arxatec',
                is_team: true,
              },
            },
          ],
        },
      ],
    });
  });

  it('una lección sin comentarios devuelve la lista vacía: E5 no es un error', async () => {
    findVisibleCommentsByLessonMock.mockResolvedValue([]);

    await expect(getCommentsService({ lesson_id: 'les_1' })).resolves.toEqual({ comments: [] });
  });

  it('el JSON del resultado no contiene ninguna arroba', async () => {
    const result = await getCommentsService({ lesson_id: 'les_1' });

    expect(JSON.stringify(result)).not.toContain('@');
  });

  it('pide los comentarios por el id que devolvió el guardián de la lección', async () => {
    requireCommentableLessonMock.mockResolvedValue({ id: 'les_9' });

    await getCommentsService({ lesson_id: 'les_1' });

    expect(findVisibleCommentsByLessonMock).toHaveBeenCalledWith('les_9');
  });

  it('una lección que no se puede ver propaga el 404 y no lee comentarios', async () => {
    requireCommentableLessonMock.mockRejectedValue(
      new AppError(CommentMessages.thread.not_found, HttpStatusCodes.NOT_FOUND.code, {
        code: ErrorCodes.NOT_FOUND,
      }),
    );

    await expect(getCommentsService({ lesson_id: 'les_1' })).rejects.toMatchObject({
      statusCode: HttpStatusCodes.NOT_FOUND.code,
    });
    expect(findVisibleCommentsByLessonMock).not.toHaveBeenCalled();
  });
});
