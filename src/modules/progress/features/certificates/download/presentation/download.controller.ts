import type { Request, Response } from 'express';
import { downloadCertificateSchema } from '@/modules/progress/shared/domain/certificate.schema';
import { downloadCertificateService } from '@/modules/progress/features/certificates/download/presentation/download.service';

export const downloadCertificateController = async (req: Request, res: Response): Promise<void> => {
  const payload = downloadCertificateSchema.parse({
    id: req.params['id'],
    language: req.query['language'],
  });
  const pdf = await downloadCertificateService(payload);
  res
    .set('Cache-Control', 'no-store')
    .type('pdf')
    .attachment(`certificado-${payload.id}.pdf`)
    .send(pdf);
};
