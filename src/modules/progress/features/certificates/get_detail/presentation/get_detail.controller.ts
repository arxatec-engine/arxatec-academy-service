import type { Request, Response } from 'express';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CertificateMessages } from '@/constants/messages/certificates';
import { certificateSchema } from '@/modules/progress/shared/domain/certificate.schema';
import { getCertificateService } from '@/modules/progress/features/certificates/get_detail/presentation/get_detail.service';
import { buildHttpResponse } from '@/utils/build_http_response';

export const getCertificateController = async (req: Request, res: Response): Promise<void> => {
  const payload = certificateSchema.parse({ id: req.params['id'] });
  const data = await getCertificateService(payload);
  res
    .set('Cache-Control', 'no-store')
    .status(HttpStatusCodes.OK.code)
    .json(
      buildHttpResponse({
        status: HttpStatusCodes.OK,
        description: CertificateMessages.success,
        path: req.originalUrl,
        data,
      }),
    );
};
