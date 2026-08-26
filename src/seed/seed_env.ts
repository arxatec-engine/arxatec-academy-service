import { z } from 'zod';

import { AuthPolicy } from '@/constants/auth';

const seedCredentialsSchema = z.object({
  SEED_ADMIN_EMAIL: z.email().max(AuthPolicy.email_max_length),
  SEED_ADMIN_PASSWORD: z.string().min(AuthPolicy.password_min_length),
  SEED_STUDENT_EMAIL: z.email().max(AuthPolicy.email_max_length),
  SEED_STUDENT_PASSWORD: z.string().min(AuthPolicy.password_min_length),
});

export type SeedCredentials = z.infer<typeof seedCredentialsSchema>;

export const readSeedCredentials = (): SeedCredentials | null => {
  const parsed = seedCredentialsSchema.safeParse(process.env);

  return parsed.success ? parsed.data : null;
};
