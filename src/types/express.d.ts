import type { AuthenticatedUser } from '@/types/authenticated_user';

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}

    interface Request {
      request_id?: string;
    }
  }
}
