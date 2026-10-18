import { MimeTypes, type MimeType } from '@/constants/files';

export interface ImageDimensions { width: number; height: number }

export const readImageDimensions = (content: Buffer, mime_type: MimeType): ImageDimensions | null => {
  if (mime_type === MimeTypes.png) {
    return content.length >= 24 ? { width: content.readUInt32BE(16), height: content.readUInt32BE(20) } : null;
  }

  if (mime_type === MimeTypes.webp) {
    if (content.length < 30) {return null;}
    const format = content.toString('ascii', 12, 16);
    if (format === 'VP8X') {
      return {
        width: 1 + content.readUIntLE(24, 3),
        height: 1 + content.readUIntLE(27, 3),
      };
    }
    if (format === 'VP8 ' && content.length >= 30) {
      return { width: content.readUInt16LE(26) & 0x3fff, height: content.readUInt16LE(28) & 0x3fff };
    }
    if (format === 'VP8L' && content.length >= 25) {
      const bits = content.readUInt32LE(21);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff) };
    }
    return null;
  }

  if (mime_type === MimeTypes.jpeg) {
    let offset = 2;
    while (offset + 4 <= content.length) {
      if (content[offset] !== 0xff) {return null;}
      const marker = content[offset + 1];
      if (marker === undefined) {return null;}
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        offset += 2;
        continue;
      }
      const length = content.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > content.length) {return null;}
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (length < 7) {return null;}
        return { height: content.readUInt16BE(offset + 5), width: content.readUInt16BE(offset + 7) };
      }
      offset += length + 2;
    }
  }
  return null;
};
