import { countCompletedEnrollments } from '@/modules/progress/shared/data/progress.repository';
import type { GetSummaryPayload } from '@/modules/user/features/account/get_summary/domain/get_summary.payload';
import { findUserSummary } from '@/modules/user/shared/data/user_account.repository';
import type { ApiUserSummary } from '@/modules/user/shared/domain/user_account.types';
import { userNotFound } from '@/modules/user/shared/domain/user_not_found';

export const getSummaryService = async (payload: GetSummaryPayload): Promise<ApiUserSummary> => {
  const user = await findUserSummary(payload.user_id);

  if (user === null) {
    throw userNotFound();
  }

  const completed_courses = await countCompletedEnrollments(payload.user_id);

  return { member_since: user.created_at.toISOString(), completed_courses };
};
