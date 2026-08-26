import { user_city, user_role } from '@/generated/enums';
import type { SeedCredentials } from '@/seed/seed_env';

export interface SeedUser {
  full_name: string;
  email: string;
  password: string;
  role: user_role;
  city: user_city;
  organization: string | null;
  is_independent: boolean;
}

export const buildSeedUsers = (credentials: SeedCredentials): readonly SeedUser[] => [
  {
    full_name: 'Admin Arxatec',
    email: credentials.SEED_ADMIN_EMAIL,
    password: credentials.SEED_ADMIN_PASSWORD,
    role: user_role.ADMIN,
    city: user_city.LIMA,
    organization: 'Arxatec',
    is_independent: false,
  },
  {
    full_name: 'María Quispe Rojas',
    email: credentials.SEED_STUDENT_EMAIL,
    password: credentials.SEED_STUDENT_PASSWORD,
    role: user_role.STUDENT,
    city: user_city.LIMA,
    organization: null,
    is_independent: true,
  },
];
