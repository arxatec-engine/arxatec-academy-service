import type { z } from 'zod';

import { env } from '@/config/env';
import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { AdminUsersMessages } from '@/constants/messages/admin_users';
import { completedCourseCounts, countDirectory,
  findDirectoryAll } from '@/modules/user/shared/data/directory.repository';
import type { directoryFiltersSchema } from '@/modules/user/shared/domain/directory_filters.schema';
import { toDirectoryCsvRow } from '@/modules/user/shared/domain/directory_row_mapper';
import { writeCsv } from '@/utils/csv';
import { AppError } from '@/utils/errors';

export const exportDirectoryService = async (filters: z.infer<typeof directoryFiltersSchema>) => {
  const row_count = await countDirectory(filters);
  if (row_count > env.ADMIN_EXPORT_MAX_ROWS) {
    throw new AppError(AdminUsersMessages.export_too_large, HttpStatusCodes.UNPROCESSABLE_ENTITY.code,
      { code: ErrorCodes.EXPORT_TOO_LARGE, row_count, max_rows: env.ADMIN_EXPORT_MAX_ROWS });
  }
  const rows = await findDirectoryAll(filters);
  const completed = await completedCourseCounts(rows.map((row) => row.id));
  const csv = writeCsv([AdminUsersMessages.csv_header,
    ...rows.map((row) => toDirectoryCsvRow(row, completed.get(row.id) ?? 0))]);
  return { csv, row_count: rows.length };
};
