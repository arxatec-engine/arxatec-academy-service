import { env } from '@/config/env';
import { FrontendRoutes } from '@/constants/endpoints';

export const certificateVerificationUrl = (id: string): string =>
  `${env.FRONTEND_URL.replace(/\/+$/, '')}${FrontendRoutes.certificate}/${encodeURIComponent(id)}`;
