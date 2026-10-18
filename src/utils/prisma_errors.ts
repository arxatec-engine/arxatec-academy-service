export const isPrismaUniqueError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error
  && Reflect.get(error, 'code') === 'P2002';
