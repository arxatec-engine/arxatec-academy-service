import QRCode from 'qrcode';

export const certificateQrDataUrl = (verification_url: string): Promise<string> =>
  QRCode.toDataURL(verification_url, {
    errorCorrectionLevel: 'M',
    width: 256,
    margin: 4,
    color: { dark: '#171717', light: '#FFFFFF' },
  });
