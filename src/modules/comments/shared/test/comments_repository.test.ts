jest.mock('@/config/prisma_client', () => ({
  prisma: {
    comments: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    comment_reports: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

import { prisma } from '@/config/prisma_client';
import { comment_status } from '@/generated/enums';
import {
  createComment,
  createCommentReport,
  deleteUserComments,
  findCommentRefById,
  findVisibleCommentsByLesson,
} from '@/modules/comments/shared/data/comments.repository';

const commentsFindMany = jest.spyOn(prisma.comments, 'findMany');
const commentsFindUnique = jest.spyOn(prisma.comments, 'findUnique');
const commentsCreate = jest.spyOn(prisma.comments, 'create');
const reportsCreateMany = jest.spyOn(prisma.comment_reports, 'createMany');

const AUTHOR_SELECT = {
  full_name: true,
  avatar_url: true,
  organization: true,
  is_independent: true,
  role: true,
};

const COMMENT_SELECT = {
  id: true,
  parent_id: true,
  body: true,
  created_at: true,
  user: { select: AUTHOR_SELECT },
};

const ROW = {
  id: 'cmt_1',
  lesson_id: 'les_1',
  user_id: 'usr_1',
  parent_id: null,
  body: 'Una pregunta',
  status: comment_status.VISIBLE,
  hidden_at: null,
  hidden_by_user_id: null,
  deleted_at: null,
  deleted_by_user_id: null,
  created_at: new Date('2026-07-01T10:00:00.000Z'),
  updated_at: new Date('2026-07-01T10:00:00.000Z'),
};

beforeEach(() => {
  jest.clearAllMocks();
  commentsFindMany.mockResolvedValue([ROW]);
  commentsFindUnique.mockResolvedValue(null);
  commentsCreate.mockResolvedValue(ROW);
  reportsCreateMany.mockResolvedValue({ count: 1 });
});

describe('findVisibleCommentsByLesson', () => {
  it('filtra por lección y VISIBLE, y ordena de más antiguo a más nuevo', async () => {
    await findVisibleCommentsByLesson('les_1');

    expect(commentsFindMany).toHaveBeenCalledWith({
      where: { lesson_id: 'les_1', status: comment_status.VISIBLE },
      select: COMMENT_SELECT,
      orderBy: { created_at: 'asc' },
    });
  });

  it('el select del autor NO pide el correo: la fuga se corta en la consulta', () => {
    expect(Object.keys(AUTHOR_SELECT)).not.toContain('email');
    expect(JSON.stringify(COMMENT_SELECT)).not.toContain('email');
  });

  it('los HIDDEN y los DELETED no se leen siquiera de la base', async () => {
    await findVisibleCommentsByLesson('les_1');

    const call = commentsFindMany.mock.calls[0]?.[0];

    expect(call?.where?.status).toBe(comment_status.VISIBLE);
    expect(call?.where?.status).not.toBe(comment_status.HIDDEN);
  });
});

describe('findCommentRefById', () => {
  it('trae solo lo que hace falta para decidir: id, lección, padre y estado', async () => {
    await findCommentRefById('cmt_1');

    expect(commentsFindUnique).toHaveBeenCalledWith({
      where: { id: 'cmt_1' },
      select: { id: true, lesson_id: true, parent_id: true, status: true },
    });
  });
});

describe('createComment', () => {
  it('escribe el cuerpo tal cual y devuelve la forma con autor reducido', async () => {
    await createComment({
      lesson_id: 'les_1',
      user_id: 'usr_1',
      parent_id: null,
      body: '<b>tal cual</b>',
    });

    expect(commentsCreate).toHaveBeenCalledWith({
      data: { lesson_id: 'les_1', user_id: 'usr_1', parent_id: null, body: '<b>tal cual</b>' },
      select: COMMENT_SELECT,
    });
  });
});

describe('createCommentReport', () => {
  it('reporta con skipDuplicates: el índice único hace la idempotencia, no un if', async () => {
    await createCommentReport({
      comment_id: 'cmt_1',
      reported_by_user_id: 'usr_1',
      reason: null,
    });

    expect(reportsCreateMany).toHaveBeenCalledWith({
      data: { comment_id: 'cmt_1', reported_by_user_id: 'usr_1', reason: null },
      skipDuplicates: true,
    });
  });

  it('reportar dos veces no lee antes de escribir: son dos escrituras iguales', async () => {
    const input = { comment_id: 'cmt_1', reported_by_user_id: 'usr_1', reason: 'spam' };

    await createCommentReport(input);
    await createCommentReport(input);

    expect(reportsCreateMany).toHaveBeenCalledTimes(2);
    expect(commentsFindUnique).not.toHaveBeenCalled();
  });
});

describe('deleteUserComments', () => {
  const commentsDeleteMany = jest.spyOn(prisma.comments, 'deleteMany');
  const reportsDeleteMany = jest.spyOn(prisma.comment_reports, 'deleteMany');

  it('borra de verdad: sus reportes primero y despues sus comentarios', async () => {
    await deleteUserComments('usr_1', prisma);

    expect(reportsDeleteMany).toHaveBeenCalledWith({
      where: { reported_by_user_id: 'usr_1' },
    });
    expect(commentsDeleteMany).toHaveBeenCalledWith({ where: { user_id: 'usr_1' } });
    expect(reportsDeleteMany.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      commentsDeleteMany.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('no marca nada: no hay un update de estado escondido en la baja', async () => {
    await deleteUserComments('usr_1', prisma);

    expect(JSON.stringify(commentsDeleteMany.mock.calls[0])).not.toContain('status');
  });
});
