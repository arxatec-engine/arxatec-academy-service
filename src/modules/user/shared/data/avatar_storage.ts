import { logger } from '@/config/logger';
import { UserMessages } from '@/constants/messages/user';
import { storage } from '@/infrastructure/storage/storage';

export const removeStoredAvatar = async (avatar_key: string | null): Promise<void> => {
  if (avatar_key === null) {
    return;
  }

  try {
    await storage.remove(avatar_key);
  } catch (error) {
    logger.warn({ err: error, avatar_key }, UserMessages.avatar.remove_failed);
  }
};
