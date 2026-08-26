import { AuthMessages } from '@/constants/messages/auth';
import type { EmailContent } from '@/infrastructure/email/email.types';
import { renderEmailContent } from '@/infrastructure/email/templates/email_layout';

export const buildPasswordChangedEmail = (): EmailContent =>
  renderEmailContent({
    subject: AuthMessages.email.password_changed_subject,
    title: AuthMessages.email.password_changed_title,
    body: AuthMessages.email.password_changed_body,
    notice: AuthMessages.email.ignore_notice,
  });
