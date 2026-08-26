import { getMailTransporter } from '@/config/email';
import { env, isProduction } from '@/config/env';
import { logger } from '@/config/logger';
import { SystemMessages } from '@/constants/messages/system';
import type { EmailMessage } from '@/infrastructure/email/email.types';

const sendThroughLog = (message: EmailMessage): void => {
  logger.info(
    {
      to: message.to,
      subject: message.subject,
      body: isProduction ? undefined : message.text,
    },
    SystemMessages.email_logged,
  );
};

const sendThroughSmtp = async (message: EmailMessage): Promise<void> => {
  await getMailTransporter().sendMail({
    from: env.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  logger.info({ to: message.to, subject: message.subject }, SystemMessages.email_sent);
};

export const sendEmail = async (message: EmailMessage): Promise<void> => {
  if (env.EMAIL_TRANSPORT === 'log') {
    sendThroughLog(message);

    return;
  }

  await sendThroughSmtp(message);
};
