import { FrontendRoutes } from '@/constants/endpoints';
import { AuthMessages } from '@/constants/messages/auth';
import type { EmailContent } from '@/infrastructure/email/email.types';
import { buildFrontendLink } from '@/infrastructure/email/frontend_link';
import { renderEmailContent } from '@/infrastructure/email/templates/email_layout';

export interface VerificationEmailInput {
  token: string;
  redirect_to?: string;
}

export const buildVerificationEmail = ({
  token,
  redirect_to,
}: VerificationEmailInput): EmailContent =>
  renderEmailContent({
    subject: AuthMessages.email.verification_subject,
    title: AuthMessages.email.verification_title,
    body: AuthMessages.email.verification_body,
    notice: AuthMessages.email.ignore_notice,
    cta: {
      label: AuthMessages.email.verification_cta,
      url: buildFrontendLink({ route: FrontendRoutes.verify_email, token, redirect_to }),
    },
  });
