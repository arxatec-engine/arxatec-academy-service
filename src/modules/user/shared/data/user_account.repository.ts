import { prisma } from '@/config/prisma_client';
import type { Prisma } from '@/generated/client';
import { deleteUserAuthArtifacts } from '@/modules/auth/shared/data/auth_artifacts.repository';
import { revokeOtherUserSessions } from '@/modules/auth/shared/data/sessions.repository';
import type { AuthUserRecord } from '@/modules/auth/shared/domain/auth_user.types';
import { deleteUserComments } from '@/modules/comments/shared/data/comments.repository';
import { deleteUserProgress } from '@/modules/progress/shared/data/progress.repository';
import type {
  ChangeUserPasswordInput,
  SetUserAvatarInput,
  UpdateUserProfileInput,
  UserAvatarRecord,
  UserCredentialsRecord,
  UserSummaryRecord,
} from '@/modules/user/shared/domain/user_account.types';

const USER_PROFILE_SELECT = {
  id: true,
  full_name: true,
  email: true,
  role: true,
  organization: true,
  is_independent: true,
  city: true,
  city_other: true,
  avatar_url: true,
  email_verified_at: true,
  auth_provider: true,
  created_at: true,
} as const satisfies Prisma.usersSelect;

const USER_CREDENTIALS_SELECT = {
  id: true,
  email: true,
  password_hash: true,
} as const satisfies Prisma.usersSelect;

const USER_AVATAR_SELECT = { avatar_key: true } as const satisfies Prisma.usersSelect;

const USER_SUMMARY_SELECT = { created_at: true } as const satisfies Prisma.usersSelect;

export const findUserCredentialsById = async (
  user_id: string,
): Promise<UserCredentialsRecord | null> =>
  prisma.users.findUnique({ where: { id: user_id }, select: USER_CREDENTIALS_SELECT });

export const findUserAvatar = async (user_id: string): Promise<UserAvatarRecord | null> =>
  prisma.users.findUnique({ where: { id: user_id }, select: USER_AVATAR_SELECT });

export const findUserSummary = async (user_id: string): Promise<UserSummaryRecord | null> =>
  prisma.users.findUnique({ where: { id: user_id }, select: USER_SUMMARY_SELECT });

export const updateUserProfile = async ({
  user_id,
  full_name,
  organization,
  is_independent,
  city,
  city_other,
}: UpdateUserProfileInput): Promise<AuthUserRecord> =>
  prisma.users.update({
    where: { id: user_id },
    data: { full_name, organization, is_independent, city, city_other },
    select: USER_PROFILE_SELECT,
  });

export const setUserAvatar = async ({
  user_id,
  avatar_url,
  avatar_key,
}: SetUserAvatarInput): Promise<AuthUserRecord> =>
  prisma.users.update({
    where: { id: user_id },
    data: { avatar_url, avatar_key },
    select: USER_PROFILE_SELECT,
  });

export const changeUserPassword = async ({
  user_id,
  session_id,
  password_hash,
  now,
}: ChangeUserPasswordInput): Promise<number> =>
  prisma.$transaction(async (tx) => {
    await tx.users.update({
      where: { id: user_id },
      data: { password_hash },
      select: { id: true },
    });

    return revokeOtherUserSessions(
      { user_id, except_session_id: session_id, revoked_at: now },
      tx,
    );
  });

export const deleteUserAccount = async (user_id: string): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await deleteUserProgress(user_id, tx);
    await deleteUserComments(user_id, tx);
    await deleteUserAuthArtifacts(user_id, tx);

    await tx.users.delete({ where: { id: user_id }, select: { id: true } });
  });
};
