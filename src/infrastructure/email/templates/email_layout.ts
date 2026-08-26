import type { EmailContent } from '@/infrastructure/email/email.types';

export interface EmailCallToAction {
  label: string;
  url: string;
}

export interface RenderEmailContentInput {
  subject: string;
  title: string;
  body: string;
  notice: string;
  cta?: EmailCallToAction;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);

const renderCtaHtml = (cta: EmailCallToAction | undefined): string => {
  if (cta === undefined) {
    return '';
  }

  return [
    '<p style="margin:24px 0;">',
    `<a href="${escapeHtml(cta.url)}" `,
    'style="background:#111827;color:#ffffff;padding:12px 20px;border-radius:8px;',
    'text-decoration:none;display:inline-block;font-weight:600;">',
    escapeHtml(cta.label),
    '</a></p>',
    `<p style="margin:0 0 16px 0;font-size:13px;color:#6b7280;word-break:break-all;">${escapeHtml(cta.url)}</p>`,
  ].join('');
};

export const renderEmailContent = ({
  subject,
  title,
  body,
  notice,
  cta,
}: RenderEmailContentInput): EmailContent => {
  const html = [
    '<!doctype html><html lang="es"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${escapeHtml(subject)}</title></head>`,
    '<body style="margin:0;padding:24px;background:#f9fafb;',
    'font-family:Helvetica,Arial,sans-serif;color:#111827;">',
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">',
    `<h1 style="margin:0 0 16px 0;font-size:20px;line-height:1.3;">${escapeHtml(title)}</h1>`,
    `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">${escapeHtml(body)}</p>`,
    renderCtaHtml(cta),
    `<p style="margin:24px 0 0 0;font-size:13px;color:#6b7280;">${escapeHtml(notice)}</p>`,
    '</div></body></html>',
  ].join('');

  const textLines = [title, '', body];

  if (cta !== undefined) {
    textLines.push('', cta.label, cta.url);
  }

  textLines.push('', notice);

  return { subject, html, text: textLines.join('\n') };
};
