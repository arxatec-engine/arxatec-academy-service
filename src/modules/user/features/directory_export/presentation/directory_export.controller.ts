import type { Request, Response } from 'express';

import { logger } from '@/config/logger';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AdminUsersMessages } from '@/constants/messages/admin_users';
import { exportDirectoryService } from '@/modules/user/features/directory_export/presentation/directory_export.service';
import { directoryFiltersSchema } from '@/modules/user/shared/domain/directory_filters.schema';
import { getAuthenticatedUser } from '@/utils/authenticated_user';
import { reportingDay } from '@/utils/reporting_date';

export const exportDirectoryController = async (req: Request, res: Response): Promise<void> => {
  const actor = getAuthenticatedUser(req);
  const filters = directoryFiltersSchema.parse(req.query);
  const result = await exportDirectoryService(filters);
  logger.info({ event: AdminUsersMessages.export_event, actor_user_id: actor.id,
    request_id: req.request_id, row_count: result.row_count,
    filters_applied: Object.keys(req.query).filter((key) => key !== 'search'),
    has_search: Boolean(filters.search) }, AdminUsersMessages.exported);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="usuarios-${reportingDay(new Date())}.csv"`);
  res.setHeader('Content-Length', result.csv.byteLength);
  res.setHeader('Cache-Control', 'no-store');
  res.status(HttpStatusCodes.OK.code).send(result.csv);
};
