import { FrontendRoutes } from '@/constants/endpoints';
import { AuthMessages } from '@/constants/messages/auth';
import type { EmailContent } from '@/infrastructure/email/email.types';
import { buildFrontendLink } from '@/infrastructure/email/frontend_link';
import { renderEmailContent } from '@/infrastructure/email/templates/email_layout';

export interface PasswordResetEmailInput {
  token: string;
  redirect_to?: string;
}

export const buildPasswordResetEmail = ({
  token,
  redirect_to,
}: PasswordResetEmailInput): EmailContent =>
  renderEmailContent({
    subject: AuthMessages.email.password_reset_subject,
    title: AuthMessages.email.password_reset_title,
    body: AuthMessages.email.password_reset_body,
    notice: AuthMessages.email.ignore_notice,
    cta: {
      label: AuthMessages.email.password_reset_cta,
      url: buildFrontendLink({ route: FrontendRoutes.reset_password, token, redirect_to }),
    },
  });
