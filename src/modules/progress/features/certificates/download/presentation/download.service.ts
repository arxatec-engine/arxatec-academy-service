import { certificateVerificationUrl } from '@/infrastructure/certificates/certificate_links';
import { createCertificatePdf } from '@/infrastructure/certificates/certificate_pdf';
import type { DownloadCertificatePayload } from '@/modules/progress/shared/domain/certificate.schema';
import { requireCertificate } from '@/modules/progress/shared/domain/require_certificate';

export const downloadCertificateService = async (
  payload: DownloadCertificatePayload,
): Promise<Buffer> => {
  const certificate = await requireCertificate(payload.id);
  return createCertificatePdf(
    certificate,
    certificateVerificationUrl(certificate.id),
    payload.language,
  );
};
