import { PrismaErrorCodes } from '@/constants/prisma';

export const isEmailTakenError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }

  const code: unknown = Reflect.get(error, 'code');

  return code === PrismaErrorCodes.unique_constraint_violation;
};
