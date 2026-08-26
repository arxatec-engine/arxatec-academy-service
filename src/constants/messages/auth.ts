export const AuthMessages = {
  register: {
    created: 'Cuenta creada correctamente',
    email_already_registered: 'Ese correo ya tiene una cuenta',
  },
  login: {
    success: 'Sesión iniciada correctamente',
    invalid_credentials: 'El correo o la contraseña no son correctos',
    account_uses_google: 'Esta cuenta se creó con Google. Continúa con Google para entrar',
  },
  logout: {
    success: 'Sesión cerrada correctamente',
    already_revoked: 'La sesión ya estaba cerrada',
  },
  me: {
    success: 'Usuario de la sesión',
  },
  password_forgot: {
    success: 'Si el correo existe, te enviamos un enlace para restablecer la contraseña',
  },
  password_reset: {
    success: 'Contraseña actualizada. Cerramos las demás sesiones por seguridad',
    token_invalid: 'El enlace no es válido, ya se usó o venció',
  },
  email_verification: {
    verified: 'Correo verificado correctamente',
    already_verified: 'Este correo ya estaba verificado',
    token_invalid: 'El enlace de verificación no es válido, ya se usó o venció',
    resend_success: 'Te enviamos otro enlace de verificación',
    resend_cooldown: 'Espera unos segundos antes de pedir otro enlace',
    required: 'Verifica tu correo para poder hacer esto',
  },
  google: {
    start: 'Redirigiendo a Google',
    callback_failed: 'No pudimos completar el ingreso con Google',
    account_linked: 'Vinculamos tu cuenta de Google con tu cuenta existente',
    exchange_success: 'Sesión iniciada con Google',
    code_invalid: 'El código de Google no es válido, ya se usó o venció',
    profile_without_email: 'Google no compartió un correo con el que podamos crear la cuenta',
    state_invalid: 'La petición de Google no es válida',
    not_configured: 'El ingreso con Google no está configurado en este entorno',
    link_unverified:
      'Google no confirmó ese correo, así que no podemos vincularlo con una cuenta existente',
  },
  session: {
    unauthenticated: 'Necesitas iniciar sesión para continuar',
    expired: 'Tu sesión venció. Vuelve a iniciar sesión',
    revoked: 'Tu sesión fue cerrada. Vuelve a iniciar sesión',
    token_malformed: 'El token de sesión no tiene un formato válido',
    not_found: 'No encontramos la sesión',
  },
  user: {
    not_found: 'No encontramos al usuario',
  },
  redirect: {
    invalid: 'El destino de retorno no es válido',
  },
  rate_limit: {
    login: 'Demasiados intentos de ingreso. Prueba de nuevo en unos minutos',
    register: 'Demasiados registros desde este equipo. Prueba de nuevo más tarde',
    password_forgot: 'Demasiadas solicitudes de recuperación. Prueba de nuevo más tarde',
    password_reset: 'Demasiados intentos. Prueba de nuevo más tarde',
    email_verify: 'Demasiados intentos. Prueba de nuevo más tarde',
    email_resend: 'Demasiados reenvíos. Prueba de nuevo más tarde',
    google_exchange: 'Demasiados intentos. Prueba de nuevo más tarde',
  },
  email: {
    verification_subject: 'Verifica tu correo en Arxatec Academy',
    verification_title: 'Confirma tu correo',
    verification_body: 'Toca el botón para confirmar tu correo. El enlace vence en 24 horas.',
    verification_cta: 'Verificar mi correo',
    password_reset_subject: 'Restablece tu contraseña de Arxatec Academy',
    password_reset_title: 'Restablece tu contraseña',
    password_reset_body:
      'Toca el botón para elegir una contraseña nueva. El enlace vence en 1 hora.',
    password_reset_cta: 'Crear una contraseña nueva',
    password_changed_subject: 'Tu contraseña de Arxatec Academy cambió',
    password_changed_title: 'Tu contraseña cambió',
    password_changed_body:
      'Cambiamos tu contraseña y cerramos las sesiones abiertas. Si no fuiste tú, escríbenos.',
    ignore_notice: 'Si no pediste esto, ignora este mensaje.',
  },
} as const;
