export const PrismaErrorCodes = {
  unique_constraint_violation: 'P2002',
  record_not_found: 'P2025',
} as const;

export type PrismaErrorCode = (typeof PrismaErrorCodes)[keyof typeof PrismaErrorCodes];
