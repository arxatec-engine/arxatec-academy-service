import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CommentMessages } from '@/constants/messages/comments';
import { CourseMessages } from '@/constants/messages/courses';
import { user_role } from '@/generated/enums';
import { createCommentService } from '@/modules/comments/features/thread/create/presentation/create.service';
import { createComment } from '@/modules/comments/shared/data/comments.repository';
import type { CommentRecord } from '@/modules/comments/shared/domain/comment.types';
import { requireCommentableLesson } from '@/modules/comments/shared/domain/commentable_lesson';
import { AppError } from '@/utils/errors';

jest.mock('@/modules/comments/shared/data/comments.repository', () => ({
  createComment: jest.fn(),
}));

jest.mock('@/modules/comments/shared/domain/commentable_lesson', () => ({
  requireCommentableLesson: jest.fn(),
}));

const createCommentMock = jest.mocked(createComment);
const requireCommentableLessonMock = jest.mocked(requireCommentableLesson);

const BODY = '¿Esto aplica a un estudio de dos personas?';

const CREATED: CommentRecord = {
  id: 'cmt_1',
  parent_id: null,
  body: BODY,
  created_at: new Date('2026-07-01T10:00:00.000Z'),
  user: {
    full_name: 'Jorge Ramírez',
    avatar_url: null, avatar_key: null,
    organization: null,
    is_independent: true,
    role: user_role.STUDENT,
  },
};

const payload = { user_id: 'usr_1', lesson_id: 'les_1', body: BODY };

beforeEach(() => {
  requireCommentableLessonMock.mockResolvedValue({ id: 'les_1' });
  createCommentMock.mockResolvedValue(CREATED);
});

describe('createCommentService', () => {
  it('escribe un comentario raíz: parent_id siempre null en esta action', async () => {
    await createCommentService(payload);

    expect(createCommentMock).toHaveBeenCalledWith({
      lesson_id: 'les_1',
      user_id: 'usr_1',
      parent_id: null,
      body: BODY,
    });
  });

  it('devuelve el comentario ya mapeado, con el autor reducido', async () => {
    const result = await createCommentService(payload);

    expect(result).toEqual({
      comment: {
        id: 'cmt_1',
        parent_id: null,
        body: BODY,
        created_at: '2026-07-01T10:00:00.000Z',
        author: {
          full_name: 'Jorge Ramírez',
          avatar_url: null,
          affiliation: CommentMessages.author.independent,
          is_team: false,
        },
      },
    });
  });

  it('el cuerpo llega al repositorio tal cual: no se escapa ni se convierte a HTML', async () => {
    const raw = 'compara a < b y usa <b>negrita</b>';

    await createCommentService({ ...payload, body: raw });

    expect(createCommentMock).toHaveBeenCalledWith(expect.objectContaining({ body: raw }));
  });

  it('una lección que no admite comentarios propaga el 404 y no escribe nada', async () => {
    requireCommentableLessonMock.mockRejectedValue(
      new AppError(CourseMessages.lesson.not_found, HttpStatusCodes.NOT_FOUND.code, {
        code: ErrorCodes.NOT_FOUND,
      }),
    );

    await expect(createCommentService(payload)).rejects.toMatchObject({
      statusCode: HttpStatusCodes.NOT_FOUND.code,
      meta: { code: ErrorCodes.NOT_FOUND },
    });
    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it('el JSON del resultado no contiene ninguna arroba', async () => {
    expect(JSON.stringify(await createCommentService(payload))).not.toContain('@');
  });
});
