import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { Express } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { createApp } from '@/app/create_app';
import { env } from '@/config/env';
import { disconnectPrisma, prisma } from '@/config/prisma_client';
import { AuthHeaders, AuthPolicy } from '@/constants/auth';
import {
  ApiPrefix,
  AuthEndpoints,
  AuthRoutePrefix,
  MeRoutePrefix,
  UserEndpoints,
} from '@/constants/endpoints';
import { ErrorCodes } from '@/constants/error_codes';
import { FileMaxSizeBytes, FileUploadField, FileUsages, MimeTypes } from '@/constants/files';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { ValidationKeys } from '@/constants/validation_keys';
import { auth_provider, oauth_provider, user_city } from '@/generated/enums';
import { sendEmail } from '@/infrastructure/email/send_email';

jest.mock('@/infrastructure/email/send_email', () => ({ sendEmail: jest.fn() }));

const sendEmailMock = jest.mocked(sendEmail);

const EMAIL_DOMAIN = '@cuenta.arxatec.test';
const OWNER_EMAIL = `titular${EMAIL_DOMAIN}`;
const GOOGLE_EMAIL = `google${EMAIL_DOMAIN}`;
const OTHER_EMAIL = `vecina${EMAIL_DOMAIN}`;
const PASSWORD = 'claveDeLaCuenta13';
const NEW_PASSWORD = 'claveNuevaDeLaCuenta';
const COURSE_SLUG = 'fundamentos-de-legal-tech';

const envelopeSchema = z.object({
  status: z.number(),
  message: z.string(),
  description: z.string(),
  timestamp: z.string(),
  path: z.string(),
  data: z.unknown().optional(),
  meta: z
    .object({
      code: z.string().optional(),
      fields: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

const userSchema = z.object({
  id: z.string(),
  full_name: z.string(),
  email: z.string(),
  organization: z.string().nullable(),
  is_independent: z.boolean(),
  city: z.string(),
  city_other: z.string().nullable(),
  avatar_url: z.string().nullable(),
});

const userDataSchema = z.object({ user: userSchema });

const summarySchema = z.object({
  member_since: z.string(),
  completed_courses: z.number(),
});

interface Account {
  id: string;
  token: string;
}

const state = {
  owner: { id: '', token: '' } as Account,
  google: { id: '', token: '' } as Account,
  other: { id: '', token: '' } as Account,
  second_owner_token: '',
  lesson_ids: [] as string[],
  comment_ids: [] as string[],
  avatar_key: '',
};

let app: Express;

const bearer = (token: string): string => `${AuthHeaders.bearer_prefix}${token}`;

const mePath = (endpoint: keyof typeof UserEndpoints): string =>
  `${ApiPrefix}${MeRoutePrefix}${UserEndpoints[endpoint]}`;

const authPath = (endpoint: keyof typeof AuthEndpoints): string =>
  `${ApiPrefix}${AuthRoutePrefix}${AuthEndpoints[endpoint]}`;

const pngOf = (size: number): Buffer =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(size - 8, 0x41),
  ]);

const storagePath = (key: string): string => join(resolve(env.STORAGE_LOCAL_PATH), key);

const fileExists = async (key: string): Promise<boolean> => {
  try {
    await access(storagePath(key));

    return true;
  } catch {
    return false;
  }
};

const registerAccount = async (full_name: string, email: string): Promise<Account> => {
  const response = await request(app).post(authPath('register')).send({
    full_name,
    email,
    password: PASSWORD,
    organization: 'Estudio Titular',
    is_independent: false,
    city: user_city.LIMA,
  });

  expect(response.status).toBe(HttpStatusCodes.CREATED.code);

  const session = z
    .object({ token: z.string(), user: z.object({ id: z.string() }) })
    .parse(envelopeSchema.parse(response.body).data);

  await prisma.users.update({
    where: { id: session.user.id },
    data: { email_verified_at: new Date() },
  });

  return { id: session.user.id, token: session.token };
};

const removeTestUsers = async (): Promise<void> => {
  await prisma.users.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
};

const removeTestComments = async (): Promise<void> => {
  await prisma.comments.deleteMany({ where: { id: { in: state.comment_ids } } });
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
    where: { course_id: course.id },
    select: { id: true },
    orderBy: { position: 'asc' },
  });

  state.lesson_ids = lessons.map((lesson) => lesson.id);

  state.owner = await registerAccount('Titular De Prueba', OWNER_EMAIL);
  state.google = await registerAccount('Cuenta Con Google', GOOGLE_EMAIL);
  state.other = await registerAccount('Vecina De Hilo', OTHER_EMAIL);

  await prisma.users.update({
    where: { id: state.google.id },
    data: { password_hash: null, auth_provider: auth_provider.GOOGLE },
  });
  await prisma.oauth_accounts.create({
    data: {
      user_id: state.google.id,
      provider: oauth_provider.GOOGLE,
      provider_account_id: `google-${state.google.id}`,
    },
  });
});

afterAll(async () => {
  await removeTestComments();
  await removeTestUsers();
  await disconnectPrisma();
});

describe('perfil y baja de cuenta contra PostgreSQL real', () => {
  it('1. PATCH /me/profile guarda los cambios y devuelve el usuario del contrato', async () => {
    const response = await request(app)
      .patch(mePath('profile'))
      .set(AuthHeaders.authorization, bearer(state.owner.token))
      .send({
        full_name: 'Titular Editado',
        organization: 'Estudio Editado',
        is_independent: false,
        city: user_city.AREQUIPA,
      });

    expect(response.status).toBe(HttpStatusCodes.OK.code);

    const data = userDataSchema.parse(envelopeSchema.parse(response.body).data);

    expect(data.user.full_name).toBe('Titular Editado');
    expect(data.user.organization).toBe('Estudio Editado');
    expect(data.user.city).toBe(user_city.AREQUIPA);
  });

  it('2. un email en el cuerpo se ignora en silencio: 200 y el correo intacto en la base', async () => {
    const response = await request(app)
      .patch(mePath('profile'))
      .set(AuthHeaders.authorization, bearer(state.owner.token))
      .send({
        full_name: 'Titular Editado',
        organization: 'Estudio Editado',
        is_independent: false,
        city: user_city.AREQUIPA,
        email: 'secuestrado@atacante.test',
      });

    expect(response.status).toBe(HttpStatusCodes.OK.code);

    const row = await prisma.users.findUniqueOrThrow({
      where: { id: state.owner.id },
      select: { email: true },
    });

    expect(row.email).toBe(OWNER_EMAIL);
  });

  it('3. is_independent: true limpia la organizacion en la base', async () => {
    await request(app)
      .patch(mePath('profile'))
      .set(AuthHeaders.authorization, bearer(state.owner.token))
      .send({
        full_name: 'Titular Editado',
        organization: 'Esta Organizacion Se Va',
        is_independent: true,
        city: user_city.OTHER,
        city_other: 'Cusco',
      });

    const row = await prisma.users.findUniqueOrThrow({
      where: { id: state.owner.id },
      select: { organization: true, is_independent: true, city_other: true },
    });

    expect(row).toEqual({ organization: null, is_independent: true, city_other: 'Cusco' });
  });

  it('4. city OTHER sin city_other responde 422', async () => {
    const response = await request(app)
      .patch(mePath('profile'))
      .set(AuthHeaders.authorization, bearer(state.owner.token))
      .send({ full_name: 'Titular Editado', is_independent: true, city: user_city.OTHER });

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(envelopeSchema.parse(response.body).meta?.fields?.['city_other']).toBe(
      ValidationKeys.auth.city_other_required,
    );
  });

  it('5. la contrasena actual incorrecta responde 401 INVALID_CREDENTIALS', async () => {
    const response = await request(app)
      .patch(mePath('password'))
      .set(AuthHeaders.authorization, bearer(state.owner.token))
      .send({ current_password: 'noEsLaClave', new_password: NEW_PASSWORD });

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(envelopeSchema.parse(response.body).meta?.code).toBe(ErrorCodes.INVALID_CREDENTIALS);
  });

  it('6. la contrasena nueva igual que la actual responde 422', async () => {
    const response = await request(app)
      .patch(mePath('password'))
      .set(AuthHeaders.authorization, bearer(state.owner.token))
      .send({ current_password: PASSWORD, new_password: PASSWORD });

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(envelopeSchema.parse(response.body).meta?.fields?.['new_password']).toBe(
      ValidationKeys.user.password_same_as_current,
    );
  });

  it('7. al cambiarla: la sesion actual sigue viva, las demas quedan revocadas y sale el aviso', async () => {
    const login = await request(app)
      .post(authPath('login'))
      .send({ email: OWNER_EMAIL, password: PASSWORD });

    state.second_owner_token = z
      .object({ token: z.string() })
      .parse(envelopeSchema.parse(login.body).data).token;

    sendEmailMock.mockClear();

    const response = await request(app)
      .patch(mePath('password'))
      .set(AuthHeaders.authorization, bearer(state.owner.token))
      .send({ current_password: PASSWORD, new_password: NEW_PASSWORD });

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(envelopeSchema.parse(response.body).data).toBeUndefined();

    const alive = await request(app)
      .get(authPath('me'))
      .set(AuthHeaders.authorization, bearer(state.owner.token));
    const dead = await request(app)
      .get(authPath('me'))
      .set(AuthHeaders.authorization, bearer(state.second_owner_token));

    expect(alive.status).toBe(HttpStatusCodes.OK.code);
    expect(dead.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(envelopeSchema.parse(dead.body).meta?.code).toBe(ErrorCodes.SESSION_EXPIRED);

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: OWNER_EMAIL,
        subject: AuthMessages.email.password_changed_subject,
      }),
    );

    const sessions = await prisma.auth_sessions.findMany({
      where: { user_id: state.owner.id },
      select: { revoked_at: true },
    });

    expect(sessions.filter((session) => session.revoked_at === null)).toHaveLength(1);
  });

  it('8. la contrasena nueva es la que vale para entrar', async () => {
    const old_login = await request(app)
      .post(authPath('login'))
      .send({ email: OWNER_EMAIL, password: PASSWORD });
    const new_login = await request(app)
      .post(authPath('login'))
      .send({ email: OWNER_EMAIL, password: NEW_PASSWORD });

    expect(old_login.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(new_login.status).toBe(HttpStatusCodes.OK.code);
  });

  it('9. una cuenta de Google responde 409 ACCOUNT_USES_GOOGLE', async () => {
    const response = await request(app)
      .patch(mePath('password'))
      .set(AuthHeaders.authorization, bearer(state.google.token))
      .send({ current_password: 'loQueSea1234', new_password: NEW_PASSWORD });

    expect(response.status).toBe(HttpStatusCodes.CONFLICT.code);
    expect(envelopeSchema.parse(response.body).meta?.code).toBe(ErrorCodes.ACCOUNT_USES_GOOGLE);
  });

  it('10. un avatar PNG se guarda en disco y su clave queda en la fila', async () => {
    const response = await request(app)
      .put(mePath('avatar'))
      .set(AuthHeaders.authorization, bearer(state.owner.token))
      .attach(FileUploadField, pngOf(1024), {
        filename: 'avatar.png',
        contentType: MimeTypes.png,
      });

    expect(response.status).toBe(HttpStatusCodes.OK.code);

    const row = await prisma.users.findUniqueOrThrow({
      where: { id: state.owner.id },
      select: { avatar_url: true, avatar_key: true },
    });

    expect(row.avatar_key).not.toBeNull();
    state.avatar_key = row.avatar_key ?? '';

    expect(row.avatar_url).toContain(state.avatar_key);
    await expect(fileExists(state.avatar_key)).resolves.toBe(true);
  });

  it('11. una foto de 2 MB exactos pasa y borra el archivo anterior del disco', async () => {
    const previous_key = state.avatar_key;

    const response = await request(app)
      .put(mePath('avatar'))
      .set(AuthHeaders.authorization, bearer(state.owner.token))
      .attach(FileUploadField, pngOf(FileMaxSizeBytes[FileUsages.avatar]), {
        filename: 'grande.png',
        contentType: MimeTypes.png,
      });

    expect(response.status).toBe(HttpStatusCodes.OK.code);

    const row = await prisma.users.findUniqueOrThrow({
      where: { id: state.owner.id },
      select: { avatar_key: true },
    });

    state.avatar_key = row.avatar_key ?? '';

    expect(state.avatar_key).not.toBe(previous_key);
    await expect(fileExists(previous_key)).resolves.toBe(false);
    await expect(fileExists(state.avatar_key)).resolves.toBe(true);
  });

  it('12. 2 MB + 1 byte responde 413 y la foto guardada no cambia', async () => {
    const response = await request(app)
      .put(mePath('avatar'))
      .set(AuthHeaders.authorization, bearer(state.owner.token))
      .attach(FileUploadField, pngOf(FileMaxSizeBytes[FileUsages.avatar] + 1), {
        filename: 'pasada.png',
        contentType: MimeTypes.png,
      });

    expect(response.status).toBe(HttpStatusCodes.PAYLOAD_TOO_LARGE.code);
    expect(envelopeSchema.parse(response.body).meta?.code).toBe(ErrorCodes.FILE_TOO_LARGE);

    const row = await prisma.users.findUniqueOrThrow({
      where: { id: state.owner.id },
      select: { avatar_key: true },
    });

    expect(row.avatar_key).toBe(state.avatar_key);
  });

  it('13. un GIF responde 415 aunque venga con el mime de un PNG', async () => {
    const gif = Buffer.from('GIF89a-una-imagen-animada', 'latin1');

    const declared_gif = await request(app)
      .put(mePath('avatar'))
      .set(AuthHeaders.authorization, bearer(state.owner.token))
      .attach(FileUploadField, gif, { filename: 'foto.gif', contentType: 'image/gif' });

    const disguised_gif = await request(app)
      .put(mePath('avatar'))
      .set(AuthHeaders.authorization, bearer(state.owner.token))
      .attach(FileUploadField, gif, { filename: 'foto.png', contentType: MimeTypes.png });

    expect(declared_gif.status).toBe(HttpStatusCodes.UNSUPPORTED_MEDIA_TYPE.code);
    expect(disguised_gif.status).toBe(HttpStatusCodes.UNSUPPORTED_MEDIA_TYPE.code);
    expect(envelopeSchema.parse(disguised_gif.body).meta?.code).toBe(ErrorCodes.INVALID_FILE_TYPE);
  });

  it('14. DELETE /me/avatar deja la fila limpia y borra el archivo', async () => {
    const key = state.avatar_key;

    const response = await request(app)
      .delete(mePath('avatar'))
      .set(AuthHeaders.authorization, bearer(state.owner.token));

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(userDataSchema.parse(envelopeSchema.parse(response.body).data).user.avatar_url).toBeNull();

    const row = await prisma.users.findUniqueOrThrow({
      where: { id: state.owner.id },
      select: { avatar_url: true, avatar_key: true },
    });

    expect(row).toEqual({ avatar_url: null, avatar_key: null });
    await expect(fileExists(key)).resolves.toBe(false);
  });

  it('15. GET /me/summary cuenta los cursos terminados de verdad', async () => {
    const before = await request(app)
      .get(mePath('summary'))
      .set(AuthHeaders.authorization, bearer(state.owner.token));

    expect(summarySchema.parse(envelopeSchema.parse(before.body).data).completed_courses).toBe(0);

    const now = new Date();
    const course = await prisma.courses.findFirstOrThrow({
      where: { slug: COURSE_SLUG },
      select: { id: true },
    });

    await prisma.enrollments.create({
      data: { user_id: state.owner.id, course_id: course.id, completed_at: now },
    });

    const after = await request(app)
      .get(mePath('summary'))
      .set(AuthHeaders.authorization, bearer(state.owner.token));

    const summary = summarySchema.parse(envelopeSchema.parse(after.body).data);
    const row = await prisma.users.findUniqueOrThrow({
      where: { id: state.owner.id },
      select: { created_at: true },
    });

    expect(summary.completed_courses).toBe(1);
    expect(summary.member_since).toBe(row.created_at.toISOString());
  });

  it('16. la baja sin contrasena en una cuenta con contrasena responde 401 y no borra nada', async () => {
    const response = await request(app)
      .delete(`${ApiPrefix}${MeRoutePrefix}`)
      .set(AuthHeaders.authorization, bearer(state.owner.token))
      .send({});

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(envelopeSchema.parse(response.body).meta?.code).toBe(ErrorCodes.INVALID_CREDENTIALS);
    await expect(prisma.users.count({ where: { id: state.owner.id } })).resolves.toBe(1);
  });

  it('17. la baja borra de verdad: cero filas suyas en las ocho tablas', async () => {
    const [first_lesson] = state.lesson_ids;

    await prisma.lesson_progress.create({
      data: {
        user_id: state.owner.id,
        lesson_id: first_lesson ?? '',
        completed_at: new Date(),
        last_position_seconds: 120,
      },
    });

    const mine = await prisma.comments.create({
      data: { lesson_id: first_lesson ?? '', user_id: state.owner.id, body: 'Un comentario mio' },
    });
    const neighbour = await prisma.comments.create({
      data: { lesson_id: first_lesson ?? '', user_id: state.other.id, body: 'Un comentario ajeno' },
    });

    state.comment_ids = [mine.id, neighbour.id];

    await prisma.comment_reports.create({
      data: { comment_id: neighbour.id, reported_by_user_id: state.owner.id, reason: 'spam' },
    });
    await prisma.comment_reports.create({
      data: { comment_id: mine.id, reported_by_user_id: state.other.id, reason: 'me molesta' },
    });
    await prisma.auth_tokens.create({
      data: {
        user_id: state.owner.id,
        type: 'PASSWORD_RESET',
        token_hash: `hash-de-la-fase-13-${state.owner.id}`,
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const response = await request(app)
      .delete(`${ApiPrefix}${MeRoutePrefix}`)
      .set(AuthHeaders.authorization, bearer(state.owner.token))
      .send({ password: NEW_PASSWORD });

    expect(response.status).toBe(HttpStatusCodes.NO_CONTENT.code);
    expect(response.text).toBe('');

    const owner_id = state.owner.id;

    await expect(prisma.users.count({ where: { id: owner_id } })).resolves.toBe(0);
    await expect(prisma.auth_sessions.count({ where: { user_id: owner_id } })).resolves.toBe(0);
    await expect(prisma.auth_tokens.count({ where: { user_id: owner_id } })).resolves.toBe(0);
    await expect(prisma.oauth_accounts.count({ where: { user_id: owner_id } })).resolves.toBe(0);
    await expect(prisma.enrollments.count({ where: { user_id: owner_id } })).resolves.toBe(0);
    await expect(prisma.lesson_progress.count({ where: { user_id: owner_id } })).resolves.toBe(0);
    await expect(prisma.comments.count({ where: { user_id: owner_id } })).resolves.toBe(0);
    await expect(
      prisma.comment_reports.count({ where: { reported_by_user_id: owner_id } }),
    ).resolves.toBe(0);

    await expect(prisma.comments.count({ where: { id: neighbour.id } })).resolves.toBe(1);
  });

  it('18. el token de la cuenta borrada deja de valer', async () => {
    const response = await request(app)
      .get(authPath('me'))
      .set(AuthHeaders.authorization, bearer(state.owner.token));

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(envelopeSchema.parse(response.body).meta?.code).toBe(ErrorCodes.SESSION_EXPIRED);
  });

  it('19. una cuenta de Google se da de baja solo con la sesion y se lleva su oauth_account', async () => {
    const response = await request(app)
      .delete(`${ApiPrefix}${MeRoutePrefix}`)
      .set(AuthHeaders.authorization, bearer(state.google.token))
      .send({});

    expect(response.status).toBe(HttpStatusCodes.NO_CONTENT.code);
    await expect(prisma.users.count({ where: { id: state.google.id } })).resolves.toBe(0);
    await expect(
      prisma.oauth_accounts.count({ where: { user_id: state.google.id } }),
    ).resolves.toBe(0);
  });

  it('20. las seis rutas exigen sesion', async () => {
    const calls = await Promise.all([
      request(app).patch(mePath('profile')).send({}),
      request(app).patch(mePath('password')).send({}),
      request(app).put(mePath('avatar')),
      request(app).delete(mePath('avatar')),
      request(app).delete(`${ApiPrefix}${MeRoutePrefix}`).send({}),
      request(app).get(mePath('summary')),
    ]);

    for (const call of calls) {
      expect(call.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
      expect(envelopeSchema.parse(call.body).meta?.code).toBe(ErrorCodes.UNAUTHENTICATED);
    }
  });

  it('21. una contrasena por debajo del minimo del registro no llega ni al service', async () => {
    const response = await request(app)
      .patch(mePath('password'))
      .set(AuthHeaders.authorization, bearer(state.other.token))
      .send({
        current_password: PASSWORD,
        new_password: 'a'.repeat(AuthPolicy.password_min_length - 1),
      });

    expect(response.status).toBe(HttpStatusCodes.UNPROCESSABLE_ENTITY.code);
    expect(envelopeSchema.parse(response.body).meta?.fields?.['new_password']).toBe(
      ValidationKeys.auth.password_too_short,
    );
  });

  it('22. la lección y el comentario del vecino siguen enteros: la baja no es un borrado global', async () => {
    const [first_lesson] = state.lesson_ids;

    await expect(
      prisma.comments.count({ where: { user_id: state.other.id } }),
    ).resolves.toBeGreaterThan(0);
    await expect(prisma.lessons.count({ where: { id: first_lesson ?? '' } })).resolves.toBe(1);
  });
});
