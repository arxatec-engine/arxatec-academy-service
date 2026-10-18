import type { z } from 'zod';

import { countDirectory, countDirectoryStats, completedCourseCounts,
  findDirectoryPage } from '@/modules/user/shared/data/directory.repository';
import type { directoryPageSchema } from '@/modules/user/shared/domain/directory_filters.schema';
import { toDirectoryRow } from '@/modules/user/shared/domain/directory_row_mapper';
import { reportingWeekStart } from '@/utils/reporting_date';

export const listDirectoryService = async (query: z.infer<typeof directoryPageSchema>) => {
  const { page, per_page, ...filters } = query;
  const week_start = reportingWeekStart(new Date());
  const [rows, total, stats] = await Promise.all([
    findDirectoryPage(filters, page, per_page),
    countDirectory(filters), countDirectoryStats(week_start),
  ]);
  const completed = await completedCourseCounts(rows.map((row) => row.id));
  return {
    data: { users: rows.map((row) => toDirectoryRow(row, completed.get(row.id) ?? 0)), stats },
    pagination: { page, per_page, total, total_pages: Math.ceil(total / per_page) },
  };
};
