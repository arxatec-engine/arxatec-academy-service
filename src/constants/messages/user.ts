export const UserMessages = {
  profile: {
    updated: 'Guardamos tus cambios',
  },
  password: {
    updated: 'Contraseña actualizada. Cerramos las demás sesiones por seguridad',
    current_invalid: 'La contraseña actual no es correcta',
    account_uses_google: 'Esta cuenta entra con Google, así que no tiene contraseña que cambiar',
  },
  avatar: {
    updated: 'Actualizamos tu foto',
    removed: 'Quitamos tu foto',
    remove_failed: 'No se pudo borrar la foto anterior del almacenamiento',
  },
  account: {
    password_required: 'Escribe tu contraseña para eliminar la cuenta',
    delete_file_failed: 'No se pudo borrar la foto de una cuenta eliminada',
  },
  summary: {
    success: 'Resumen de tu cuenta',
  },
} as const;
