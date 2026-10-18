import { ErrorCodes } from '@/constants/error_codes';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { CertificateMessages } from '@/constants/messages/certificates';
import { findCertificateById } from '@/modules/progress/shared/data/certificates.repository';
import type { CertificateRecord } from '@/modules/progress/shared/domain/certificate.types';
import { AppError } from '@/utils/errors';

export const requireCertificate = async (id: string): Promise<CertificateRecord> => {
  const certificate = await findCertificateById(id);
  if (certificate === null) {
    throw new AppError(CertificateMessages.not_found, HttpStatusCodes.NOT_FOUND.code, {
      code: ErrorCodes.NOT_FOUND,
    });
  }
  return certificate;
};
