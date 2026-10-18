import { z } from 'zod';
import { ValidationKeys } from '@/constants/validation_keys';

export const certificateSchema = z.object({ id: z.uuid(ValidationKeys.common.invalid) });
export type CertificatePayload = z.infer<typeof certificateSchema>;

export const downloadCertificateSchema = certificateSchema.extend({
  language: z.enum(['es', 'en', 'pt']).default('es'),
});
export type DownloadCertificatePayload = z.infer<typeof downloadCertificateSchema>;
