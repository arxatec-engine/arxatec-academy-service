import { FileSignatures, type FileSignature } from '@/constants/files';

interface SignaturePattern {
  signature: FileSignature;
  offset: number;
  bytes: readonly number[];
  also?: { offset: number; bytes: readonly number[] };
}

const PATTERNS: readonly SignaturePattern[] = [
  { signature: FileSignatures.jpeg, offset: 0, bytes: [0xff, 0xd8, 0xff] },
  {
    signature: FileSignatures.png,
    offset: 0,
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  {
    signature: FileSignatures.webp,
    offset: 0,
    bytes: [0x52, 0x49, 0x46, 0x46],
    also: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
  },
  { signature: FileSignatures.pdf, offset: 0, bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { signature: FileSignatures.zip, offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] },
  {
    signature: FileSignatures.ole,
    offset: 0,
    bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
  },
];

const matchesAt = (content: Buffer, offset: number, bytes: readonly number[]): boolean => {
  if (content.length < offset + bytes.length) {
    return false;
  }

  return bytes.every((byte, index) => content[offset + index] === byte);
};

export const detectFileSignature = (content: Buffer): FileSignature | null => {
  for (const pattern of PATTERNS) {
    if (!matchesAt(content, pattern.offset, pattern.bytes)) {
      continue;
    }

    if (pattern.also !== undefined && !matchesAt(content, pattern.also.offset, pattern.also.bytes)) {
      continue;
    }

    return pattern.signature;
  }

  return null;
};
