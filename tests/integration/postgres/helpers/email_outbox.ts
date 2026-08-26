import type { EmailMessage } from '@/infrastructure/email/email.types';

const outbox: EmailMessage[] = [];

const TOKEN_PATTERN = /[?&]token=([A-Za-z0-9_-]+)/;

export const recordEmail = (message: EmailMessage): void => {
  outbox.push(message);
};

export const clearOutbox = (): void => {
  outbox.length = 0;
};

export const emailsFor = (recipient: string): EmailMessage[] =>
  outbox.filter((message) => message.to === recipient);

export const lastEmailFor = (recipient: string): EmailMessage => {
  const messages = emailsFor(recipient);
  const last = messages.at(-1);

  if (last === undefined) {
    throw new Error(`No hay correos para ${recipient}`);
  }

  return last;
};

export const tokenFromEmail = (message: EmailMessage): string => {
  const found = TOKEN_PATTERN.exec(message.text);

  if (found?.[1] === undefined) {
    throw new Error(`El correo "${message.subject}" no lleva un enlace con token`);
  }

  return found[1];
};
