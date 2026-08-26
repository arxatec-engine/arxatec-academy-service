import { prisma } from '@/config/prisma_client';
import type { Prisma } from '@/generated/client';

export const deleteUserAuthArtifacts = async (
  user_id: string,
  client: Prisma.TransactionClient = prisma,
): Promise<void> => {
  await client.auth_sessions.deleteMany({ where: { user_id } });
  await client.auth_tokens.deleteMany({ where: { user_id } });
  await client.oauth_accounts.deleteMany({ where: { user_id } });
};
