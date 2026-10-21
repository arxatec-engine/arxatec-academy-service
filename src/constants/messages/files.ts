export const FileMessages = {
  invalid_type: 'El archivo no tiene un formato permitido para este uso',
  too_large: 'El archivo pesa más de lo permitido',
  storage_key_invalid: 'La ruta del archivo no es válida',
  storage_config_invalid: 'La configuración del almacenamiento S3 o de CloudFront no es válida',
  storage_unavailable: 'El almacenamiento de archivos no está disponible. Intenta nuevamente',
  cleanup_failed: 'No se pudo procesar la limpieza de archivos; se reintentará',
  cleanup_retry: 'El archivo sigue pendiente de eliminación; se reintentará',
  cleanup_invalid_key: 'Se descartó una clave de almacenamiento no válida de la limpieza',
} as const;
