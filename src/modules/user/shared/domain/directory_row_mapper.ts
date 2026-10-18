import { AdminUsersMessages } from '@/constants/messages/admin_users';
import { user_city } from '@/generated/enums';
import { reportingDay } from '@/utils/reporting_date';

export interface DirectoryRow {
  id: string; full_name: string; email: string; organization: string | null;
  is_independent: boolean; city: user_city; city_other: string | null;
  created_at: Date; email_verified_at: Date | null;
}

export const toDirectoryRow = (row: DirectoryRow, completed_courses: number) => ({
  id: row.id, full_name: row.full_name, email: row.email,
  organization: row.organization, is_independent: row.is_independent,
  city: row.city, city_other: row.city_other,
  created_at: row.created_at.toISOString(),
  email_verified_at: row.email_verified_at?.toISOString() ?? null,
  completed_courses,
});

export const toDirectoryCsvRow = (row: DirectoryRow, completed_courses: number) => [
  row.full_name, row.email,
  row.is_independent ? AdminUsersMessages.independent : row.organization,
  row.city === user_city.OTHER ? row.city_other : AdminUsersMessages.cities[row.city],
  reportingDay(row.created_at), completed_courses,
] as const;
