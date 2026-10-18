import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import academyLogo from './assets/academy_logo.json';

interface CertificateDocument {
  id: string;
  recipient_name: string;
  course_title: string;
  completed_at: Date;
  issued_at: Date;
}

export type CertificateLanguage = 'es' | 'en' | 'pt';

const COPY = {
  es: {
    title: 'Certificado de finalización',
    verified: 'Certificado verificado',
    awarded_to: 'Otorgado a',
    completed_course: 'por completar el curso',
    completion_date: 'Fecha de finalización',
    identifier: 'Identificador del certificado',
    qr_hint: 'Escanea para verificar',
  },
  en: {
    title: 'Certificate of completion',
    verified: 'Verified certificate',
    awarded_to: 'Awarded to',
    completed_course: 'for completing the course',
    completion_date: 'Completion date',
    identifier: 'Certificate ID',
    qr_hint: 'Scan to verify',
  },
  pt: {
    title: 'Certificado de conclusão',
    verified: 'Certificado verificado',
    awarded_to: 'Concedido a',
    completed_course: 'pela conclusão do curso',
    completion_date: 'Data de conclusão',
    identifier: 'Identificador do certificado',
    qr_hint: 'Escaneie para verificar',
  },
} as const;

// Public desktop preview: centered card and full-page frame, using arxatec-ui tokens.
const LAYOUT = {
  page_width: 1024,
  page_min_height: 640,
  page_min_inset: 48,
  width: 768,
  inset: 21,
  content_width: 726,
  gap: 20,
  group_gap: 6,
  small: { size: 13.2, line_height: 19.8 },
  title: { size: 24.2, line_height: 33 },
  course: { size: 15.4, line_height: 22 },
  badge: { size: 11, line_height: 15.4, height: 19.4 },
  qr_size: 128,
  qr_gap: 2,
  footer_padding: 13,
} as const;
const COLORS = {
  background: '#ffffff',
  card: '#fafafa',
  foreground: '#0a0a0a',
  muted: '#737373',
  border: '#e5e5e5',
  badge: '#f5f5f5',
  badge_text: '#171717',
} as const;
const regularFont = readFileSync(join(__dirname, 'assets/ArxatecSans-Regular.ttf'));
const mediumFont = readFileSync(join(__dirname, 'assets/ArxatecSans-Medium.ttf'));

interface TextStyle {
  size: number;
  line_height: number;
  medium?: boolean;
  color?: string;
  align?: 'left' | 'center';
}

const registerFonts = (document: PDFKit.PDFDocument): void => {
  document.registerFont('Regular', regularFont).registerFont('Medium', mediumFont);
};

const prepareText = (document: PDFKit.PDFDocument, style: TextStyle): number => {
  document.font(style.medium ? 'Medium' : 'Regular').fontSize(style.size);
  return style.line_height - document.currentLineHeight(true);
};

const textHeight = (
  document: PDFKit.PDFDocument,
  text: string,
  width: number,
  style: TextStyle,
): number => {
  const lineGap = prepareText(document, style);
  return document.heightOfString(text, { width, lineGap });
};

const drawText = (
  document: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  style: TextStyle,
): void => {
  const lineGap = prepareText(document, style);
  document.fillColor(style.color ?? COLORS.foreground).text(text, x, y + lineGap / 2, {
    width,
    lineGap,
    align: style.align ?? 'left',
  });
};

const drawLogo = (document: PDFKit.PDFDocument, x: number, y: number): void => {
  document
    .save()
    .translate(x, y)
    .scale(140 / 270);
  for (const path of academyLogo.paths) {
    document.path(path).fill(COLORS.foreground);
  }
  const { cx, cy, r } = academyLogo.separator;
  document.circle(cx, cy, r).fill(COLORS.foreground).restore();
};

const drawQr = (document: PDFKit.PDFDocument, url: string, x: number, y: number): void => {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const cell = (LAYOUT.qr_size - 2) / (qr.modules.size + 8);
  document
    .roundedRect(x + 0.5, y + 0.5, LAYOUT.qr_size - 1, LAYOUT.qr_size - 1, 5.5)
    .lineWidth(1)
    .fillAndStroke('#ffffff', COLORS.border);
  for (let row = 0; row < qr.modules.size; row++) {
    for (let column = 0; column < qr.modules.size; column++) {
      if (qr.modules.get(row, column)) {
        document.rect(x + 1 + (column + 4) * cell, y + 1 + (row + 4) * cell, cell, cell);
      }
    }
  }
  document.fill('#171717').link(x, y, LAYOUT.qr_size, LAYOUT.qr_size, url);
};

export const createCertificatePdf = (
  certificate: CertificateDocument,
  verification_url: string,
  language: CertificateLanguage = 'es',
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const copy = COPY[language];
    const name = certificate.recipient_name.replace(/\s+/gu, ' ').trim();
    const course = certificate.course_title.replace(/\s+/gu, ' ').trim();
    const nameStyle = { ...LAYOUT.title, medium: true };
    const courseStyle = { ...LAYOUT.course, medium: true };
    const smallStyle = LAYOUT.small;
    const mutedStyle = { ...smallStyle, color: COLORS.muted };
    const measure = new PDFDocument({ size: [LAYOUT.width, 4096], margin: 0 });
    registerFonts(measure);
    const titleY = LAYOUT.inset + LAYOUT.badge.height + LAYOUT.gap;
    const awardedY = titleY + LAYOUT.title.line_height + LAYOUT.gap;
    const nameY = awardedY + smallStyle.line_height + LAYOUT.group_gap;
    const completedCourseY =
      nameY + textHeight(measure, name, LAYOUT.content_width, nameStyle) + LAYOUT.group_gap;
    const courseY = completedCourseY + smallStyle.line_height + LAYOUT.group_gap;
    const separatorY =
      courseY + textHeight(measure, course, LAYOUT.content_width, courseStyle) + LAYOUT.gap;
    const footerY = separatorY + LAYOUT.footer_padding;
    const cardHeight =
      footerY + LAYOUT.qr_size + LAYOUT.qr_gap + smallStyle.line_height + LAYOUT.inset;
    const pageHeight = Math.max(LAYOUT.page_min_height, cardHeight + 2 * LAYOUT.page_min_inset);
    const cardX = (LAYOUT.page_width - LAYOUT.width) / 2;
    const cardY = (pageHeight - cardHeight) / 2;
    measure.end();
    measure.resume();

    const document = new PDFDocument({
      size: [LAYOUT.page_width, pageHeight],
      margin: 0,
      info: {
        Title: `${copy.title} - ${certificate.course_title}`,
        Author: 'Arxatec Academy',
        Subject: `${copy.title} - ${certificate.recipient_name}`,
        CreationDate: certificate.issued_at,
      },
    });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    document.on('error', reject);
    document.on('end', () => resolve(Buffer.concat(chunks)));
    registerFonts(document);
    document.rect(0, 0, LAYOUT.page_width, pageHeight).fill(COLORS.background);
    document.rect(cardX, cardY, LAYOUT.width, cardHeight).fill(COLORS.card);
    document
      .moveTo(0, cardY)
      .lineTo(LAYOUT.page_width, cardY)
      .moveTo(0, cardY + cardHeight)
      .lineTo(LAYOUT.page_width, cardY + cardHeight)
      .moveTo(cardX, 0)
      .lineTo(cardX, pageHeight)
      .moveTo(cardX + LAYOUT.width, 0)
      .lineTo(cardX + LAYOUT.width, pageHeight)
      .lineWidth(1)
      .stroke(COLORS.border);
    document.save().translate(cardX, cardY);

    drawLogo(document, LAYOUT.inset, LAYOUT.inset + (LAYOUT.badge.height - (140 * 35) / 270) / 2);
    prepareText(document, { ...LAYOUT.badge, medium: true });
    const badgeWidth = document.widthOfString(copy.verified) + 14;
    const badgeX = LAYOUT.width - LAYOUT.inset - badgeWidth;
    document
      .roundedRect(badgeX, LAYOUT.inset, badgeWidth, LAYOUT.badge.height, 6)
      .fill(COLORS.badge);
    drawText(document, copy.verified, badgeX + 7, LAYOUT.inset + 2, badgeWidth - 14, {
      ...LAYOUT.badge,
      medium: true,
      color: COLORS.badge_text,
      align: 'center',
    });
    drawText(document, copy.title, LAYOUT.inset, titleY, LAYOUT.content_width, LAYOUT.title);
    drawText(document, copy.awarded_to, LAYOUT.inset, awardedY, LAYOUT.content_width, mutedStyle);
    drawText(document, name, LAYOUT.inset, nameY, LAYOUT.content_width, nameStyle);
    drawText(
      document,
      copy.completed_course,
      LAYOUT.inset,
      completedCourseY,
      LAYOUT.content_width,
      mutedStyle,
    );
    drawText(document, course, LAYOUT.inset, courseY, LAYOUT.content_width, courseStyle);
    document
      .moveTo(LAYOUT.inset, separatorY + 0.5)
      .lineTo(LAYOUT.width - LAYOUT.inset, separatorY + 0.5)
      .lineWidth(1)
      .stroke(COLORS.border);

    const date = new Intl.DateTimeFormat(language, {
      dateStyle: 'long',
      timeZone: 'America/Lima',
    }).format(certificate.completed_at);
    const detailsWidth = LAYOUT.content_width - LAYOUT.qr_size - 16;
    drawText(document, copy.completion_date, LAYOUT.inset, footerY, detailsWidth, mutedStyle);
    drawText(
      document,
      date,
      LAYOUT.inset,
      footerY + smallStyle.line_height + 2,
      detailsWidth,
      smallStyle,
    );
    const identifierY = footerY + smallStyle.line_height * 2 + 12;
    drawText(document, copy.identifier, LAYOUT.inset, identifierY, detailsWidth, mutedStyle);
    drawText(
      document,
      certificate.id,
      LAYOUT.inset,
      identifierY + smallStyle.line_height + 2,
      detailsWidth,
      smallStyle,
    );
    const qrX = LAYOUT.width - LAYOUT.inset - LAYOUT.qr_size;
    drawQr(document, verification_url, qrX, footerY);
    drawText(
      document,
      copy.qr_hint,
      qrX,
      footerY + LAYOUT.qr_size + LAYOUT.qr_gap,
      LAYOUT.qr_size,
      {
        ...mutedStyle,
        align: 'center',
      },
    );
    document.restore().end();
  });
