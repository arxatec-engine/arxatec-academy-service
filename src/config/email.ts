import { createTransport, type Transporter } from 'nodemailer';

import { env } from '@/config/env';

let transporter: Transporter | null = null;

const buildTransporter = (): Transporter =>
  createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER === undefined
        ? undefined
        : { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? '' },
  });

export const getMailTransporter = (): Transporter => {
  transporter ??= buildTransporter();

  return transporter;
};

export const closeMailTransporter = (): void => {
  if (transporter === null) {
    return;
  }

  transporter.close();
  transporter = null;
};
