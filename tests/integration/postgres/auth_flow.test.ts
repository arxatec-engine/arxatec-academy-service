import type { Express } from 'express';

import { createApp } from '@/app/create_app';
import { disconnectPrisma, prisma } from '@/config/prisma_client';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { auth_token_type, user_city } from '@/generated/enums';
import { sendEmail } from '@/infrastructure/email/send_email';

import { clearOutbox, lastEmailFor, recordEmail, tokenFromEmail } from './helpers/email_outbox';
import { getJson, postJson, sessionDataSchema } from './helpers/auth_client';

jest.mock('@/infrastructure/email/send_email', () => ({ sendEmail: jest.fn() }));

const sendEmailMock = jest.mocked(sendEmail);

const EMAIL_DOMAIN = '@integracion.arxatec.test';
const ACCOUNT_EMAIL = `maria${EMAIL_DOMAIN}`;
const UNKNOWN_EMAIL = `nadie${EMAIL_DOMAIN}`;
const FIRST_PASSWORD = 'claveInicialLarga';
const SECOND_PASSWORD = 'claveNuevaMasLarga';

interface FlowState {
  user_id: string;
  register_token: string;
  register_session_id: string;
  verification_token: string;
  login_token: string;
  reset_token: string;
}

const state: FlowState = {
  user_id: '',
  register_token: '',
  register_session_id: '',
  verification_token: '',
  login_token: '',
  reset_token: '',
};

const removeTestUsers = async (): Promise<void> => {
  await prisma.users.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
};

const countActiveSessions = async (user_id: string): Promise<number> =>
  prisma.auth_sessions.count({ where: { user_id, revoked_at: null } });

const serialized = (value: unknown): string => JSON.stringify(value);

let app: Express;

beforeAll(async () => {
  app = createApp();
  await removeTestUsers();
  clearOutbox();
});

beforeEach(() => {
  sendEmailMock.mockImplementation((message) => {
    recordEmail(message);

    return Promise.resolve();
  });
});

afterAll(async () => {
  await removeTestUsers();
  await disconnectPrisma();
});

describe('flujo completo de autenticacion contra PostgreSQL real', () => {
  it('1. POST /auth/register crea la cuenta, abre sesion y manda el correo de verificacion', async () => {
    const response = await postJson(app, 'register', {
      full_name: 'María Quispe Rojas',
      email: ` ${ACCOUNT_EMAIL.toUpperCase()} `,
      password: FIRST_PASSWORD,
      organization: 'Estudio Quispe & Rojas',
      is_independent: false,
      city: user_city.LIMA,
    });

    expect(response.status).toBe(HttpStatusCodes.CREATED.code);

    const session = sessionDataSchema.parse(response.body.data);

    expect(session.user.email).toBe(ACCOUNT_EMAIL);
    expect(session.user.email_verified_at).toBeNull();
    expect(session.user.organization).toBe('Estudio Quispe & Rojas');
    expect(serialized(response.raw_body)).not.toContain('password_hash');
    expect(serialized(response.raw_body)).not.toContain(FIRST_PASSWORD);

    state.user_id = session.user.id;
    state.register_token = session.token;

    const stored = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { password_hash: true, email_verified_at: true, email: true },
    });

    expect(stored?.email).toBe(ACCOUNT_EMAIL);
    expect(stored?.email_verified_at).toBeNull();
    expect(stored?.password_hash).toMatch(/^\$argon2id\$/);

    const sessions = await prisma.auth_sessions.findMany({
      where: { user_id: session.user.id },
      select: { id: true, remember_me: true },
    });

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.remember_me).toBe(true);
    state.register_session_id = sessions[0]?.id ?? '';

    state.verification_token = tokenFromEmail(lastEmailFor(ACCOUNT_EMAIL));

    const token_rows = await prisma.auth_tokens.findMany({
      where: { user_id: session.user.id, type: auth_token_type.EMAIL_VERIFICATION },
      select: { token_hash: true },
    });

    expect(token_rows).toHaveLength(1);
    expect(token_rows[0]?.token_hash).not.toBe(state.verification_token);
  });

  it('2. GET /auth/me devuelve al usuario de la sesion recien creada', async () => {
    const response = await getJson(app, 'me', state.register_token);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(serialized(response.raw_body)).not.toContain('password_hash');
  });

  it('3. POST /auth/email/verify marca el correo como verificado', async () => {
    const response = await postJson(app, 'email_verify', { token: state.verification_token });

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body.description).toBe(AuthMessages.email_verification.verified);
    expect(response.body.meta).toBeUndefined();

    const stored = await prisma.users.findUnique({
      where: { id: state.user_id },
      select: { email_verified_at: true },
    });

    expect(stored?.email_verified_at).not.toBeNull();
  });

  it('4. el segundo clic en el mismo enlace responde 200 con EMAIL_ALREADY_VERIFIED', async () => {
    const response = await postJson(app, 'email_verify', { token: state.verification_token });

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body.meta?.code).toBe(ErrorCodes.EMAIL_ALREADY_VERIFIED);
  });

  it('5. POST /auth/logout revoca la sesion en la base de datos', async () => {
    const response = await postJson(app, 'logout', {}, state.register_token);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body.description).toBe(AuthMessages.logout.success);

    const stored = await prisma.auth_sessions.findUnique({
      where: { id: state.register_session_id },
      select: { revoked_at: true },
    });

    expect(stored?.revoked_at).not.toBeNull();
  });

  it('6. un segundo logout con el mismo token sigue respondiendo 200 (contrato 4.3)', async () => {
    const response = await postJson(app, 'logout', {}, state.register_token);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body.description).toBe(AuthMessages.logout.already_revoked);
  });

  it('7. el token de una sesion revocada ya no sirve para GET /auth/me', async () => {
    const response = await getJson(app, 'me', state.register_token);

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(response.body.meta?.code).toBe(ErrorCodes.SESSION_EXPIRED);
  });

  it('8. POST /auth/login abre una sesion nueva con la contrasena original', async () => {
    const response = await postJson(app, 'login', {
      email: ACCOUNT_EMAIL,
      password: FIRST_PASSWORD,
      remember_me: false,
    });

    expect(response.status).toBe(HttpStatusCodes.OK.code);

    const session = sessionDataSchema.parse(response.body.data);

    expect(session.user.email_verified_at).not.toBeNull();
    expect(serialized(response.raw_body)).not.toContain('password_hash');

    state.login_token = session.token;

    expect(await countActiveSessions(state.user_id)).toBe(1);
  });

  it('9. contrasena incorrecta y correo inexistente devuelven la misma respuesta', async () => {
    const wrong_password = await postJson(app, 'login', {
      email: ACCOUNT_EMAIL,
      password: 'otraClaveQueNoEs',
    });
    const unknown_email = await postJson(app, 'login', {
      email: UNKNOWN_EMAIL,
      password: FIRST_PASSWORD,
    });

    expect(wrong_password.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(wrong_password.status).toBe(unknown_email.status);
    expect(wrong_password.body.description).toBe(unknown_email.body.description);
    expect(wrong_password.body.meta?.code).toBe(ErrorCodes.INVALID_CREDENTIALS);
    expect(unknown_email.body.meta?.code).toBe(ErrorCodes.INVALID_CREDENTIALS);
  });

  it('10. POST /auth/password/forgot responde igual exista o no el correo', async () => {
    const existing = await postJson(app, 'password_forgot', { email: ACCOUNT_EMAIL });
    const missing = await postJson(app, 'password_forgot', { email: UNKNOWN_EMAIL });

    expect(existing.status).toBe(HttpStatusCodes.OK.code);
    expect(missing.status).toBe(HttpStatusCodes.OK.code);
    expect(existing.body.description).toBe(missing.body.description);
    expect(existing.body.data).toBeUndefined();

    state.reset_token = tokenFromEmail(lastEmailFor(ACCOUNT_EMAIL));

    const stored = await prisma.auth_tokens.findMany({
      where: { user_id: state.user_id, type: auth_token_type.PASSWORD_RESET, consumed_at: null },
      select: { token_hash: true },
    });

    expect(stored).toHaveLength(1);
    expect(stored[0]?.token_hash).not.toBe(state.reset_token);
  });

  it('11. POST /auth/password/reset cambia la clave y revoca todas las sesiones abiertas', async () => {
    expect(await countActiveSessions(state.user_id)).toBe(1);

    const response = await postJson(app, 'password_reset', {
      token: state.reset_token,
      password: SECOND_PASSWORD,
    });

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body.description).toBe(AuthMessages.password_reset.success);
    expect(await countActiveSessions(state.user_id)).toBe(0);
  });

  it('12. el token de la sesion anterior al reset queda invalidado', async () => {
    const response = await getJson(app, 'me', state.login_token);

    expect(response.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(response.body.meta?.code).toBe(ErrorCodes.SESSION_EXPIRED);
  });

  it('13. el token de recuperacion es de un solo uso', async () => {
    const response = await postJson(app, 'password_reset', {
      token: state.reset_token,
      password: 'otraClaveDistintaLarga',
    });

    expect(response.status).toBe(HttpStatusCodes.BAD_REQUEST.code);
    expect(response.body.meta?.code).toBe(ErrorCodes.TOKEN_INVALID);
  });

  it('14. la contrasena vieja ya no entra y la nueva si', async () => {
    const with_old = await postJson(app, 'login', {
      email: ACCOUNT_EMAIL,
      password: FIRST_PASSWORD,
    });

    expect(with_old.status).toBe(HttpStatusCodes.UNAUTHORIZED.code);
    expect(with_old.body.meta?.code).toBe(ErrorCodes.INVALID_CREDENTIALS);

    const with_new = await postJson(app, 'login', {
      email: ACCOUNT_EMAIL,
      password: SECOND_PASSWORD,
    });

    expect(with_new.status).toBe(HttpStatusCodes.OK.code);

    const session = sessionDataSchema.parse(with_new.body.data);

    expect(session.user.id).toBe(state.user_id);
    expect(await countActiveSessions(state.user_id)).toBe(1);
  });
});
