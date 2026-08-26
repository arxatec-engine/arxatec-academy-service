export const MimeTypes = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
} as const;

export type MimeType = (typeof MimeTypes)[keyof typeof MimeTypes];

export const FileUsages = {
  course_cover: 'course_cover',
  lesson_resource: 'lesson_resource',
  avatar: 'avatar',
} as const;

export type FileUsage = (typeof FileUsages)[keyof typeof FileUsages];

const MEGABYTE = 1024 * 1024;

export const FileMaxSizeBytes = {
  [FileUsages.course_cover]: 5 * MEGABYTE,
  [FileUsages.lesson_resource]: 20 * MEGABYTE,
  [FileUsages.avatar]: 2 * MEGABYTE,
} as const satisfies Record<FileUsage, number>;

export const FileAllowedMimeTypes = {
  [FileUsages.course_cover]: [MimeTypes.jpeg, MimeTypes.png, MimeTypes.webp],
  [FileUsages.lesson_resource]: [
    MimeTypes.pdf,
    MimeTypes.doc,
    MimeTypes.docx,
    MimeTypes.xls,
    MimeTypes.xlsx,
    MimeTypes.ppt,
    MimeTypes.pptx,
  ],
  [FileUsages.avatar]: [MimeTypes.jpeg, MimeTypes.png],
} as const satisfies Record<FileUsage, readonly MimeType[]>;

export const FileExtensions = {
  [MimeTypes.jpeg]: '.jpg',
  [MimeTypes.png]: '.png',
  [MimeTypes.webp]: '.webp',
  [MimeTypes.pdf]: '.pdf',
  [MimeTypes.doc]: '.doc',
  [MimeTypes.docx]: '.docx',
  [MimeTypes.xls]: '.xls',
  [MimeTypes.xlsx]: '.xlsx',
  [MimeTypes.ppt]: '.ppt',
  [MimeTypes.pptx]: '.pptx',
} as const satisfies Record<MimeType, string>;

export const FileSignatures = {
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
  pdf: 'pdf',
  zip: 'zip',
  ole: 'ole',
} as const;

export type FileSignature = (typeof FileSignatures)[keyof typeof FileSignatures];

export const FileSignatureByMimeType = {
  [MimeTypes.jpeg]: FileSignatures.jpeg,
  [MimeTypes.png]: FileSignatures.png,
  [MimeTypes.webp]: FileSignatures.webp,
  [MimeTypes.pdf]: FileSignatures.pdf,
  [MimeTypes.doc]: FileSignatures.ole,
  [MimeTypes.docx]: FileSignatures.zip,
  [MimeTypes.xls]: FileSignatures.ole,
  [MimeTypes.xlsx]: FileSignatures.zip,
  [MimeTypes.ppt]: FileSignatures.ole,
  [MimeTypes.pptx]: FileSignatures.zip,
} as const satisfies Record<MimeType, FileSignature>;

export const FileUploadField = 'file';

export const FileUploadMaxFiles = 1;

export const FileUploadSizeSlack = 1;

export const StorageDrivers = {
  local: 'local',
  s3: 's3',
} as const;

export type StorageDriver = (typeof StorageDrivers)[keyof typeof StorageDrivers];

export const StorageKeyPrefix = {
  [FileUsages.course_cover]: 'course_covers',
  [FileUsages.lesson_resource]: 'lesson_resources',
  [FileUsages.avatar]: 'avatars',
} as const satisfies Record<FileUsage, string>;

export const MulterErrorCodes = {
  file_too_large: 'LIMIT_FILE_SIZE',
} as const;
