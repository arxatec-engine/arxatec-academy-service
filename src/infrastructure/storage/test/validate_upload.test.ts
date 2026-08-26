import { ErrorCodes } from '@/constants/error_codes';
import { FileMaxSizeBytes, FileUsages, MimeTypes } from '@/constants/files';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { detectFileSignature } from '@/infrastructure/storage/file_signature';
import { validateUpload } from '@/infrastructure/storage/validate_upload';
import { isAppError } from '@/utils/errors';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PDF_HEADER = Buffer.from('%PDF-1.7\n%\xe2\xe3\xcf\xd3', 'latin1');
const WEBP_HEADER = Buffer.concat([
  Buffer.from('RIFF', 'latin1'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'latin1'),
]);
const EXE_HEADER = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);

const expectAppError = (run: () => unknown, status: number, code: string): void => {
  try {
    run();
  } catch (error: unknown) {
    expect(isAppError(error)).toBe(true);

    if (isAppError(error)) {
      expect(error.statusCode).toBe(status);
      expect(error.meta?.code).toBe(code);
    }

    return;
  }

  throw new Error('se esperaba un AppError y no se lanzo ninguno');
};

describe('detectFileSignature', () => {
  it('reconoce las firmas que el producto acepta', () => {
    expect(detectFileSignature(PNG_HEADER)).toBe('png');
    expect(detectFileSignature(JPEG_HEADER)).toBe('jpeg');
    expect(detectFileSignature(WEBP_HEADER)).toBe('webp');
    expect(detectFileSignature(PDF_HEADER)).toBe('pdf');
  });

  it('devuelve null cuando no reconoce nada', () => {
    expect(detectFileSignature(EXE_HEADER)).toBeNull();
    expect(detectFileSignature(Buffer.alloc(0))).toBeNull();
  });
});

describe('validateUpload', () => {
  it('acepta un tipo permitido para el uso', () => {
    expect(
      validateUpload({
        usage: FileUsages.course_cover,
        mime_type: MimeTypes.png,
        size_bytes: PNG_HEADER.byteLength,
        content: PNG_HEADER,
      }),
    ).toEqual({
      usage: FileUsages.course_cover,
      mime_type: MimeTypes.png,
      size_bytes: PNG_HEADER.byteLength,
    });
  });

  it('rechaza un tipo prohibido para ese uso aunque sea valido para otro', () => {
    expectAppError(
      () =>
        validateUpload({
          usage: FileUsages.avatar,
          mime_type: MimeTypes.webp,
          size_bytes: WEBP_HEADER.byteLength,
          content: WEBP_HEADER,
        }),
      HttpStatusCodes.UNSUPPORTED_MEDIA_TYPE.code,
      ErrorCodes.INVALID_FILE_TYPE,
    );

    expectAppError(
      () =>
        validateUpload({
          usage: FileUsages.course_cover,
          mime_type: MimeTypes.pdf,
          size_bytes: PDF_HEADER.byteLength,
          content: PDF_HEADER,
        }),
      HttpStatusCodes.UNSUPPORTED_MEDIA_TYPE.code,
      ErrorCodes.INVALID_FILE_TYPE,
    );
  });

  it('acepta el tamano limite exacto y rechaza uno por encima', () => {
    const limit = FileMaxSizeBytes[FileUsages.avatar];

    expect(
      validateUpload({
        usage: FileUsages.avatar,
        mime_type: MimeTypes.jpeg,
        size_bytes: limit,
        content: JPEG_HEADER,
      }).size_bytes,
    ).toBe(limit);

    expectAppError(
      () =>
        validateUpload({
          usage: FileUsages.avatar,
          mime_type: MimeTypes.jpeg,
          size_bytes: limit + 1,
          content: JPEG_HEADER,
        }),
      HttpStatusCodes.PAYLOAD_TOO_LARGE.code,
      ErrorCodes.FILE_TOO_LARGE,
    );
  });

  it('caza el mime mentido: un ejecutable renombrado a PDF', () => {
    expectAppError(
      () =>
        validateUpload({
          usage: FileUsages.lesson_resource,
          mime_type: MimeTypes.pdf,
          size_bytes: EXE_HEADER.byteLength,
          content: EXE_HEADER,
        }),
      HttpStatusCodes.UNSUPPORTED_MEDIA_TYPE.code,
      ErrorCodes.INVALID_FILE_TYPE,
    );
  });

  it('caza tambien el PNG que dice ser JPEG', () => {
    expectAppError(
      () =>
        validateUpload({
          usage: FileUsages.avatar,
          mime_type: MimeTypes.jpeg,
          size_bytes: PNG_HEADER.byteLength,
          content: PNG_HEADER,
        }),
      HttpStatusCodes.UNSUPPORTED_MEDIA_TYPE.code,
      ErrorCodes.INVALID_FILE_TYPE,
    );
  });
});
