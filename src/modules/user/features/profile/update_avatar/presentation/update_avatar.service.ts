import { FileUsages } from '@/constants/files';
import { storage } from '@/infrastructure/storage/storage';
import { buildStorageKey } from '@/infrastructure/storage/storage_key';
import { validateUpload } from '@/infrastructure/storage/validate_upload';
import { toApiUser } from '@/modules/auth/shared/domain/user_mapper';
import type {
  UpdateAvatarCommand,
  UpdateAvatarResult,
} from '@/modules/user/features/profile/update_avatar/domain/update_avatar.types';
import { removeStoredAvatar } from '@/modules/user/shared/data/avatar_storage';
import { findUserAvatar, setUserAvatar } from '@/modules/user/shared/data/user_account.repository';
import { userNotFound } from '@/modules/user/shared/domain/user_not_found';

export const updateAvatarService = async (
  command: UpdateAvatarCommand,
): Promise<UpdateAvatarResult> => {
  const validated = validateUpload({
    usage: FileUsages.avatar,
    mime_type: command.mime_type,
    size_bytes: command.size_bytes,
    content: command.content,
  });

  const previous = await findUserAvatar(command.user_id);

  if (previous === null) {
    throw userNotFound();
  }

  const stored = await storage.save({
    key: buildStorageKey({ usage: validated.usage, mime_type: validated.mime_type }),
    content: command.content,
    mime_type: validated.mime_type,
  });

  const user = await setUserAvatar({
    user_id: command.user_id,
    avatar_url: stored.url,
    avatar_key: stored.key,
  });

  await removeStoredAvatar(previous.avatar_key);

  return { user: toApiUser(user) };
};
