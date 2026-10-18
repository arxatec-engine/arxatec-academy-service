import { Router } from 'express';
import { CertificateEndpoints } from '@/constants/endpoints';
import { getCertificateController } from '@/modules/progress/features/certificates/get_detail/presentation/get_detail.controller';
import { downloadCertificateController } from '@/modules/progress/features/certificates/download/presentation/download.controller';

export const certificatesRouter: Router = Router();

certificatesRouter.get(CertificateEndpoints.detail, getCertificateController);
certificatesRouter.get(CertificateEndpoints.download, downloadCertificateController);
