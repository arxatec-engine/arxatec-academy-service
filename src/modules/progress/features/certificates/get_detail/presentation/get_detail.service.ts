import { certificateVerificationUrl } from '@/infrastructure/certificates/certificate_links';
import { certificateQrDataUrl } from '@/infrastructure/certificates/certificate_qr';
import type { CertificatePayload } from '@/modules/progress/shared/domain/certificate.schema';
import type { ApiCertificate } from '@/modules/progress/shared/domain/certificate.types';
import { requireCertificate } from '@/modules/progress/shared/domain/require_certificate';

export const getCertificateService = async (
  payload: CertificatePayload,
): Promise<{ certificate: ApiCertificate }> => {
  const certificate = await requireCertificate(payload.id);
  const verification_url = certificateVerificationUrl(certificate.id);
  return {
    certificate: {
      id: certificate.id,
      recipient_name: certificate.recipient_name,
      course_title: certificate.course_title,
      completed_at: certificate.completed_at.toISOString(),
      issued_at: certificate.issued_at.toISOString(),
      verification_url,
      qr_code_data_url: await certificateQrDataUrl(verification_url),
    },
  };
};
