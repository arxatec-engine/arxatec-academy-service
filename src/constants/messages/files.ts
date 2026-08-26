export const FileMessages = {
  invalid_type: 'El archivo no tiene un formato permitido para este uso',
  too_large: 'El archivo pesa más de lo permitido',
  storage_key_invalid: 'La ruta del archivo no es válida',
  s3_not_implemented:
    'El adaptador de almacenamiento S3 todavía no está implementado: usa STORAGE_DRIVER=local',
} as const;
