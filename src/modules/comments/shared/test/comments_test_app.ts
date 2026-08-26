import express, { type Express, type Router } from 'express';

import { AuthHeaders } from '@/constants/auth';
import { ApiPrefix } from '@/constants/endpoints';
import { user_role } from '@/generated/enums';
import { signSessionToken } from '@/infrastructure/jwt/sign_session_token';
import { registerErrorHandler } from '@/middlewares/error_handler';
import type { SessionWithUser } from '@/modules/auth/shared/domain/session.types';

export const TEST_USER_ID = 'usr_1';
export const TEST_SESSION_ID = 'ses_1';

const NOW = new Date();

export interface TestSessionOptions {
  email_verified_at?: Date | null;
  role?: user_role;
}

export const buildCommentsApp = (prefix: string, router: Router): Express => {
  const app = express();

  app.use(express.json());
  app.use(`${ApiPrefix}${prefix}`, router);
  registerErrorHandler(app);

  return app;
};

export const testSession = ({
  email_verified_at = NOW,
  role = user_role.STUDENT,
}: TestSessionOptions = {}): SessionWithUser => ({
  id: TEST_SESSION_ID,
  user_id: TEST_USER_ID,
  remember_me: true,
  created_at: NOW,
  expires_at: new Date(NOW.getTime() + 60 * 60 * 1000),
  last_used_at: NOW,
  revoked_at: null,
  user: {
    id: TEST_USER_ID,
    email: 'maria@estudioqp.pe',
    role,
    email_verified_at,
  },
});

export const testBearer = (): string =>
  `${AuthHeaders.bearer_prefix}${signSessionToken({
    user_id: TEST_USER_ID,
    session_id: TEST_SESSION_ID,
    role: user_role.STUDENT,
    absolute_expires_at: new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
    issued_at: new Date(NOW.getTime() - 2 * 60 * 60 * 1000),
  })}`;
