import type { Express } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { createApp } from '@/app/create_app';
import { disconnectPrisma, prisma } from '@/config/prisma_client';
import { AuthHeaders } from '@/constants/auth';
import { CommentPolicy, CommentRateLimits } from '@/constants/comments';
import {
  ApiPrefix,
  AuthEndpoints,
  AuthRoutePrefix,
  CommentsRoutePrefix,
  LessonsRoutePrefix,
} from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CommentMessages } from '@/constants/messages/comments';
import { comment_status, lesson_status, user_city, user_role } from '@/generated/enums';
import { sendEmail } from '@/infrastructure/email/send_email';

jest.mock('@/infrastructure/email/send_email', () => ({ sendEmail: jest.fn() }));

const sendEmailMock = jest.mocked(sendEmail);

const EMAIL_DOMAIN = '@comentarios.arxatec.test';
const AUTHOR_EMAIL = `autora${EMAIL_DOMAIN}`;
const TEAM_EMAIL = `equipo${EMAIL_DOMAIN}`;
const INDEPENDENT_EMAIL = `independiente${EMAIL_DOMAIN}`;
const SPAMMER_EMAIL = `spam${EMAIL_DOMAIN}`;
const PASSWORD = 'claveDeComentariosLarga';
const COURSE_SLUG = 'fundamentos-de-legal-tech';
const ORGANIZATION = 'Estudio Ramírez Abogados';
const AUTHOR_NAME = 'Jorge Ramirez Soto';

const envelopeSchema = z.object({
  status: z.number(),
  message: z.string(),
  description: z.string(),
  timestamp: z.string(),
  path: z.string(),
  data: z.unknown().optional(),
  meta: z.object({ code: z.string().optional() }).optional(),
});

const authorSchema = z.object({
  full_name: z.string(),
  avatar_url: z.string().nullable(),
  affiliation: z.string().nullable(),
  is_team: z.boolean(),
});

const commentSchema = z.object({
  id: z.string(),
  parent_id: z.string().nullable(),
  body: z.string(),
  created_at: z.string(),
  author: authorSchema.nullable(),
});

const threadListSchema = z.object({
  comments: z.array(commentSchema.extend({ replies: z.array(commentSchema) })),
});

const createdSchema = z.object({ comment: commentSchema });

interface Account {
  id: string;
  token: string;
}

interface FlowState {
  author: Account;
  team: Account;
  independent: Account;
  spammer: Account;
  lesson_id: string;
  other_lesson_id: string;
  root_comment_id: string;
  reply_comment_id: string;
}

const state: FlowState = {
  author: { id: '', token: '' },
  team: { id: '', token: '' },
  independent: { id: '', token: '' },
  spammer: { id: '', token: '' },
  lesson_id: '',
  other_lesson_id: '',
  root_comment_id: '',
  reply_comment_id: '',
};

let app: Express;

const bearer = (token: string): string => `${AuthHeaders.bearer_prefix}${token}`;

const registerAccount = async (
  full_name: string,
  email: string,
  organization: string | null,
  is_independent: boolean,
): Promise<Account> => {
  const response = await request(app)
    .post(`${ApiPrefix}${AuthRoutePrefix}${AuthEndpoints.register}`)
    .send({
      full_name,
      email,
      password: PASSWORD,
      organization,
      is_independent,
      city: user_city.LIMA,
    });

  expect(response.status).toBe(HttpStatusCodes.CREATED.code);

  const session = z
    .object({ token: z.string(), user: z.object({ id: z.string() }) })
    .parse(envelopeSchema.parse(response.body).data);

  return { id: session.user.id, token: session.token };
};

const verifyAccount = async (id: string): Promise<void> => {
  await prisma.users.update({ where: { id }, data: { email_verified_at: new Date() } });
};

const listComments = (lesson_id: string) =>
  request(app).get(`${ApiPrefix}${LessonsRoutePrefix}/${lesson_id}/comments`);

const postComment = (token: string | null, lesson_id: string, body: unknown) => {
  const pending = request(app)
    .post(`${ApiPrefix}${LessonsRoutePrefix}/${lesson_id}/comments`)
    .send({ body });

  return token === null ? pending : pending.set(AuthHeaders.authorization, bearer(token));
};

const postReply = (token: string, comment_id: string, body: string) =>
  request(app)
    .post(`${ApiPrefix}${CommentsRoutePrefix}/${comment_id}/replies`)
    .set(AuthHeaders.authorization, bearer(token))
    .send({ body });

const postReport = (token: string, comment_id: string, reason?: string) =>
  request(app)
    .post(`${ApiPrefix}${CommentsRoutePrefix}/${comment_id}/report`)
    .set(AuthHeaders.authorization, bearer(token))
    .send(reason === undefined ? {} : { reason });

const removeTestUsers = async (): Promise<void> => {
  await prisma.users.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
};

const removeTestComments = async (): Promise<void> => {
  await prisma.comments.deleteMany({
    where: { lesson_id: { in: [state.lesson_id, state.other_lesson_id] } },
  });
};

beforeAll(async () => {
  app = createApp();
  sendEmailMock.mockResolvedValue(undefined);
  await removeTestUsers();

  const course = await prisma.courses.findFirstOrThrow({
    where: { slug: COURSE_SLUG },
    select: { id: true },
  });
  const lessons = await prisma.lessons.findMany({
    where: { course_id: course.id, status: lesson_status.PUBLISHED },
    select: { id: true },
    orderBy: { position: 'asc' },
  });

  state.lesson_id = lessons[0]?.id ?? '';
  state.other_lesson_id = lessons[1]?.id ?? '';

  await removeTestComments();

  state.author = await registerAccount(AUTHOR_NAME, AUTHOR_EMAIL, ORGANIZATION, false);
  state.team = await registerAccount('Equipo Arxatec', TEAM_EMAIL, 'Arxatec', false);
  state.independent = await registerAccount('Ana Sola Vera', INDEPENDENT_EMAIL, null, true);
  state.spammer = await registerAccount('Spam Repetido', SPAMMER_EMAIL, null, true);

  await prisma.users.update({
    where: { id: state.team.id },
    data: { role: user_role.ADMIN },
  });
});

afterAll(async () => {
  await removeTestComments();
  await removeTestUsers();
  await disconnectPrisma();
});

describe('comentarios contra PostgreSQL real', () => {
  it('1. una lección sin comentarios responde 200 con la lista vacía (E5)', async () => {
    const response = await listComments(state.lesson_id);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(threadListSchema.parse(envelopeSchema.parse(response.body).data)).toEqual({
      comments: [],
    });
  });

  it('2. sin sesión el comentario responde 401 UNAUTHENTICATED', async () => {
    const response = await postComment(null, state.lesson_id, 'Sin sesión no se comenta');

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(envelopeSchema.parse(response.body).meta?.code).toBe(ErrorCodes.UNAUTHENTICATED);
  });

  it('3. con la cuenta SIN verificar responde 403 EMAIL_NOT_VERIFIED (D-006)', async () => {
    const response = await postComment(
      state.author.token,
      state.lesson_id,
      'Todavía sin verificar',
    );

    expect(response.status).toBe(HttpStatusCodes.FORBIDDEN.code);
    expect(envelopeSchema.parse(response.body).meta?.code).toBe(ErrorCodes.EMAIL_NOT_VERIFIED);

    await expect(prisma.comments.count({ where: { user_id: state.author.id } })).resolves.toBe(0);
  });

  it('4. tras verificar el correo, el mismo comentario responde 201', async () => {
    await verifyAccount(state.author.id);
    await verifyAccount(state.team.id);
    await verifyAccount(state.independent.id);
    await verifyAccount(state.spammer.id);

    const response = await postComment(
      state.author.token,
      state.lesson_id,
      '¿Esto aplica a un estudio de dos personas?',
    );

    expect(response.status).toBe(HttpStatusCodes.CREATED.code);

    const created = createdSchema.parse(envelopeSchema.parse(response.body).data);

    state.root_comment_id = created.comment.id;

    expect(created.comment.parent_id).toBeNull();
    expect(created.comment.author).toEqual({
      full_name: AUTHOR_NAME,
      avatar_url: null,
      affiliation: ORGANIZATION,
      is_team: false,
    });
  });

  it('5. la respuesta de un ADMIN llega con la insignia del equipo', async () => {
    const response = await postReply(state.team.token, state.root_comment_id, 'Sí, aplica igual.');

    expect(response.status).toBe(HttpStatusCodes.CREATED.code);

    const created = createdSchema.parse(envelopeSchema.parse(response.body).data);

    state.reply_comment_id = created.comment.id;

    expect(created.comment.parent_id).toBe(state.root_comment_id);
    expect(created.comment.author?.is_team).toBe(true);
  });

  it('6. bajarle el rol al autor le quita la insignia de lo que ya había escrito', async () => {
    await prisma.users.update({
      where: { id: state.team.id },
      data: { role: user_role.STUDENT },
    });

    const degraded = await listComments(state.lesson_id);
    const degraded_threads = threadListSchema.parse(envelopeSchema.parse(degraded.body).data);

    expect(degraded_threads.comments[0]?.replies[0]?.author?.is_team).toBe(false);

    await prisma.users.update({
      where: { id: state.team.id },
      data: { role: user_role.ADMIN },
    });

    const restored = await listComments(state.lesson_id);
    const restored_threads = threadListSchema.parse(envelopeSchema.parse(restored.body).data);

    expect(restored_threads.comments[0]?.replies[0]?.author?.is_team).toBe(true);
  });

  it('7. el listado público no lleva el correo de nadie: ni una arroba en el JSON', async () => {
    const response = await listComments(state.lesson_id);
    const serialized = JSON.stringify(response.body);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(serialized).toContain(AUTHOR_NAME);
    expect(serialized).not.toContain('@');
    expect(serialized).not.toContain(AUTHOR_EMAIL);
  });

  it('8. la afiliación sale de la organización o del texto de independiente', async () => {
    const created = await postComment(
      state.independent.token,
      state.lesson_id,
      'Trabajo solo y me sirvió igual',
    );

    expect(created.status).toBe(HttpStatusCodes.CREATED.code);

    const response = await listComments(state.lesson_id);
    const threads = threadListSchema.parse(envelopeSchema.parse(response.body).data);

    expect(threads.comments[0]?.author?.affiliation).toBe(ORGANIZATION);
    expect(threads.comments[1]?.author?.affiliation).toBe(CommentMessages.author.independent);
  });

  it('9. responder a una respuesta devuelve 422 VALIDATION_ERROR', async () => {
    const response = await postReply(
      state.author.token,
      state.reply_comment_id,
      'Respondiendo a la respuesta',
    );

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(envelopeSchema.parse(response.body).meta?.code).toBe(ErrorCodes.VALIDATION_ERROR);

    await expect(
      prisma.comments.count({ where: { parent_id: state.reply_comment_id } }),
    ).resolves.toBe(0);
  });

  it('10. reportar dos veces responde 200 las dos y deja UNA sola fila', async () => {
    const first = await postReport(state.independent.token, state.root_comment_id, 'Es publicidad');
    const second = await postReport(state.independent.token, state.root_comment_id);

    expect(first.status).toBe(HttpStatusCodes.OK.code);
    expect(second.status).toBe(HttpStatusCodes.OK.code);
    expect(envelopeSchema.parse(second.body).description).toBe(CommentMessages.report.success);
    expect(second.body).not.toHaveProperty('data');

    const reports = await prisma.comment_reports.findMany({
      where: { comment_id: state.root_comment_id },
      select: { reported_by_user_id: true, reason: true },
    });

    expect(reports).toEqual([
      { reported_by_user_id: state.independent.id, reason: 'Es publicidad' },
    ]);
  });

  it('11. reportar no exige el correo verificado y dos personas distintas sí suman dos filas', async () => {
    const response = await postReport(state.team.token, state.root_comment_id);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    await expect(
      prisma.comment_reports.count({ where: { comment_id: state.root_comment_id } }),
    ).resolves.toBe(2);
  });

  it('12. un HIDDEN y un DELETED desaparecen del listado público, con sus respuestas', async () => {
    await prisma.comments.update({
      where: { id: state.root_comment_id },
      data: { status: comment_status.HIDDEN },
    });

    const hidden = await listComments(state.lesson_id);
    const hidden_threads = threadListSchema.parse(envelopeSchema.parse(hidden.body).data);

    expect(hidden_threads.comments.map((thread) => thread.id)).not.toContain(state.root_comment_id);
    expect(JSON.stringify(hidden_threads)).not.toContain(state.reply_comment_id);

    await prisma.comments.update({
      where: { id: state.root_comment_id },
      data: { status: comment_status.DELETED },
    });

    const deleted = await listComments(state.lesson_id);
    const deleted_threads = threadListSchema.parse(envelopeSchema.parse(deleted.body).data);

    expect(deleted_threads.comments.map((thread) => thread.id)).not.toContain(
      state.root_comment_id,
    );

    await prisma.comments.update({
      where: { id: state.root_comment_id },
      data: { status: comment_status.VISIBLE },
    });
  });

  it('13. el cuerpo vacío, el de solo espacios y el de 2 001 caracteres responden 422', async () => {
    const empty = await postComment(state.independent.token, state.lesson_id, '');
    const blank = await postComment(state.independent.token, state.lesson_id, '     ');
    const over = await postComment(
      state.independent.token,
      state.lesson_id,
      'a'.repeat(CommentPolicy.body_max_length + 1),
    );

    expect([empty.status, blank.status, over.status]).toEqual([
      HttpStatusCodes.UNPROCESSABLE_ENTITY.code,
      HttpStatusCodes.UNPROCESSABLE_ENTITY.code,
      HttpStatusCodes.UNPROCESSABLE_ENTITY.code,
    ]);
  });

  it('14. el cuerpo se guarda como texto plano, tal cual llegó', async () => {
    const raw = '<b>ojo</b> con a < b';
    const response = await postComment(state.team.token, state.lesson_id, raw);

    expect(response.status).toBe(HttpStatusCodes.CREATED.code);

    const created = createdSchema.parse(envelopeSchema.parse(response.body).data);
    const stored = await prisma.comments.findUniqueOrThrow({
      where: { id: created.comment.id },
      select: { body: true },
    });

    expect(stored.body).toBe(raw);
    expect(created.comment.body).toBe(raw);
  });

  it('15. una lección en borrador no acepta ni devuelve comentarios: 404', async () => {
    await prisma.lessons.update({
      where: { id: state.other_lesson_id },
      data: { status: lesson_status.DRAFT },
    });

    const listed = await listComments(state.other_lesson_id);
    const written = await postComment(state.team.token, state.other_lesson_id, 'En un borrador');

    await prisma.lessons.update({
      where: { id: state.other_lesson_id },
      data: { status: lesson_status.PUBLISHED },
    });

    expect(listed.status).toBe(HttpStatusCodes.NOT_FOUND.code);
    expect(written.status).toBe(HttpStatusCodes.NOT_FOUND.code);
  });

  it(`16. el comentario ${String(CommentRateLimits.create.max + 1)} de la hora responde 429 RATE_LIMITED`, async () => {
    const statuses: number[] = [];

    for (let attempt = 0; attempt < CommentRateLimits.create.max + 1; attempt += 1) {
      statuses.push(
        (await postComment(state.spammer.token, state.lesson_id, `Comentario ${String(attempt)}`))
          .status,
      );
    }

    expect(statuses.slice(0, CommentRateLimits.create.max)).toEqual(
      Array.from({ length: CommentRateLimits.create.max }, () => HttpStatusCodes.CREATED.code),
    );
    expect(statuses.at(-1)).toBe(HttpStatusCodes.TOO_MANY_REQUESTS.code);

    await expect(prisma.comments.count({ where: { user_id: state.spammer.id } })).resolves.toBe(
      CommentRateLimits.create.max,
    );
  });

  it('17. borrar una cuenta deja sus comentarios sin autor (SetNull) y se lleva sus reportes', async () => {
    const report = await postReport(state.spammer.token, state.root_comment_id);

    expect(report.status).toBe(HttpStatusCodes.OK.code);

    const before_comments = await prisma.comments.count({ where: { user_id: state.spammer.id } });
    const before_reports = await prisma.comment_reports.count({
      where: { reported_by_user_id: state.spammer.id },
    });

    await prisma.users.delete({ where: { id: state.spammer.id } });

    expect(before_comments).toBe(CommentRateLimits.create.max);
    expect(before_reports).toBe(1);
    await expect(prisma.comments.count({ where: { user_id: state.spammer.id } })).resolves.toBe(0);
    await expect(
      prisma.comment_reports.count({ where: { reported_by_user_id: state.spammer.id } }),
    ).resolves.toBe(0);

    const response = await listComments(state.lesson_id);
    const threads = threadListSchema.parse(envelopeSchema.parse(response.body).data);

    expect(threads.comments.filter((thread) => thread.author === null)).toHaveLength(
      CommentRateLimits.create.max,
    );
  });
});
