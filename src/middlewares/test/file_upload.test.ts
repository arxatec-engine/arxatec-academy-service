import express, { type Express } from 'express';
import request from 'supertest';

import { ErrorCodes } from '@/constants/error_codes';
import { FileMaxSizeBytes, FileUploadField, FileUsages, MimeTypes } from '@/constants/files';
import { HttpStatusCodes } from '@/constants/http_status_codes';
import { FileMessages } from '@/constants/messages/files';
import { registerErrorHandler } from '@/middlewares/error_handler';
import { createFileUpload } from '@/middlewares/file_upload';

const UPLOAD_PATH = '/upload';

const buildApp = (): Express => {
  const app = express();

  app.post(UPLOAD_PATH, createFileUpload(FileUsages.avatar), (req, res) => {
    res.status(HttpStatusCodes.OK.code).json({ size: req.file?.size ?? 0 });
  });
  registerErrorHandler(app);

  return app;
};

const upload = async (bytes: number) =>
  request(buildApp()).post(UPLOAD_PATH).attach(FileUploadField, Buffer.alloc(bytes, 0x41), {
    filename: 'avatar.png',
    contentType: MimeTypes.png,
  });

describe('createFileUpload', () => {
  it('deja pasar un archivo por debajo del limite y lo entrega en memoria', async () => {
    const response = await upload(1024);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toEqual({ size: 1024 });
  });

  it('el tamano limite exacto pasa: la pantalla promete "hasta 2 MB", no "menos de"', async () => {
    const limit = FileMaxSizeBytes[FileUsages.avatar];

    const response = await upload(limit);

    expect(response.status).toBe(HttpStatusCodes.OK.code);
    expect(response.body).toEqual({ size: limit });
  });

  it('corta en el borde de multer y el manejador global traduce LIMIT_FILE_SIZE', async () => {
    const response = await upload(FileMaxSizeBytes[FileUsages.avatar] + 1);

    expect(response.status).toBe(HttpStatusCodes.PAYLOAD_TOO_LARGE.code);
    expect(response.body).toMatchObject({
      status: HttpStatusCodes.PAYLOAD_TOO_LARGE.code,
      message: HttpStatusCodes.PAYLOAD_TOO_LARGE.message,
      description: FileMessages.too_large,
      meta: { code: ErrorCodes.FILE_TOO_LARGE },
    });
  });

  it('un campo de formulario inesperado cae en el sobre de validacion', async () => {
    const response = await request(buildApp())
      .post(UPLOAD_PATH)
      .attach('otro_campo', Buffer.alloc(16, 0x41), {
        filename: 'avatar.png',
        contentType: MimeTypes.png,
      });

    expect(response.status).toBe(HttpStatusCodes.BAD_REQUEST.code);
    expect(response.body).toMatchObject({ meta: { code: ErrorCodes.VALIDATION_ERROR } });
  });
});
