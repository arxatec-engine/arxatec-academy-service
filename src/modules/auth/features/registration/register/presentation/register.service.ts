import { logger } from '@/config/logger';
import { AuthTokenTtlSeconds } from '@/constants/auth';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AuthMessages } from '@/constants/messages/auth';
import { SystemMessages } from '@/constants/messages/system';
import { auth_provider } from '@/generated/enums';
import { sendEmail } from '@/infrastructure/email/send_email';
import { buildVerificationEmail } from '@/infrastructure/email/templates/verification_email';
import { signSessionToken } from '@/infrastructure/jwt/sign_session_token';
import { hashPassword } from '@/infrastructure/password/hash_password';
import { createOneTimeToken } from '@/infrastructure/tokens/one_time_token';
import {
  createEmailVerificationToken,
  invalidateEmailVerificationToken,
  isEmailRegistered,
} from '@/modules/auth/features/registration/register/data/register.repository';
import type {
  RegisterCommand,
  RegisterResult,
} from '@/modules/auth/features/registration/register/domain/register.types';
import { isEmailTakenError } from '@/modules/auth/features/registration/register/utils/is_email_taken_error';
import { createSession } from '@/modules/auth/shared/data/sessions.repository';
import { createUser } from '@/modules/auth/shared/data/users.repository';
import { resolveAccountFields } from '@/modules/auth/shared/domain/account_fields';
import type { AuthUserRecord } from '@/modules/auth/shared/domain/auth_user.types';
import { toApiUser } from '@/modules/auth/shared/domain/user_mapper';
import {
  computeSessionAbsoluteExpiresAt,
  computeSessionExpiresAt,
} from '@/modules/auth/shared/policy/session_policy';
import { AppError } from '@/utils/errors';

const REGISTER_REMEMBER_ME = true;

const emailAlreadyRegistered = (): AppError =>
  new AppError(AuthMessages.register.email_already_registered, HttpStatusCodes.CONFLICT.code, {
    code: ErrorCodes.EMAIL_ALREADY_REGISTERED,
  });

const createAccount = async (
  command: RegisterCommand,
  password_hash: string,
): Promise<AuthUserRecord> => {
  const fields = resolveAccountFields({
    organization: command.organization,
    is_independent: command.is_independent,
    city: command.city,
    city_other: command.city_other,
  });

  try {
    return await createUser({
      full_name: command.full_name,
      email: command.email,
      password_hash,
      organization: fields.organization,
      is_independent: command.is_independent,
      city: command.city,
      city_other: fields.city_other,
      auth_provider: auth_provider.PASSWORD,
    });
  } catch (error) {
    if (isEmailTakenError(error)) {
      throw emailAlreadyRegistered();
    }

    throw error;
  }
};

const sendVerificationEmail = async (user: AuthUserRecord): Promise<void> => {
  const verification = createOneTimeToken(AuthTokenTtlSeconds.email_verification);

  const savedToken = await createEmailVerificationToken({
    user_id: user.id,
    token_hash: verification.token_hash,
    expires_at: verification.expires_at,
  });

  try {
    await sendEmail({ to: user.email, ...buildVerificationEmail({ token: verification.token }) });
  } catch (error) {
    await invalidateEmailVerificationToken(savedToken.id);
    throw error;
  }
};

export const registerUser = async (command: RegisterCommand): Promise<RegisterResult> => {
  if (await isEmailRegistered(command.email)) {
    throw emailAlreadyRegistered();
  }

  const password_hash = await hashPassword(command.password);
  const user = await createAccount(command, password_hash);

  const session = await createSession({
    user_id: user.id,
    remember_me: REGISTER_REMEMBER_ME,
    expires_at: computeSessionExpiresAt({ remember_me: REGISTER_REMEMBER_ME }),
    user_agent: command.user_agent,
    ip_address: command.ip_address,
  });

  const token = signSessionToken({
    user_id: user.id,
    session_id: session.id,
    role: user.role,
    absolute_expires_at: computeSessionAbsoluteExpiresAt(session.created_at),
  });

  let verification_email_sent = false;
  try {
    await sendVerificationEmail(user);
    verification_email_sent = true;
  } catch (error) {
    logger.error({ err: error, user_id: user.id }, SystemMessages.email_failed);
  }

  return {
    token,
    expires_at: session.expires_at.toISOString(),
    user: toApiUser(user),
    verification_email_sent,
  };
};
