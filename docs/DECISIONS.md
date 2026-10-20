# Decisiones de Academy Service

Estas decisiones describen el comportamiento presente. El estado de producción y la evidencia
de pruebas se documentan en [PRODUCTION_READINESS](PRODUCTION_READINESS.md) y
[shipped](shipped/README.md); no se heredan las verificaciones del servicio Admin.

| Decisión                                       | Estado                              | Motivo y consecuencia                                                                                                                                     |
| ---------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-001 · API modular en un proceso              | En uso                              | Express 5, TypeScript estricto y slices verticales permiten compartir arranque, errores y persistencia sin separar procesos por pantalla                  |
| D-002 · Correo sin cola                        | En uso                              | Registro conserva la cuenta ante fallo SMTP y devuelve `verification_email_sent: false` para permitir reenvío; recuperación inicia el envío sin esperarlo |
| D-003 · Base propia de Academy                 | En uso                              | Usuarios, contenido y aprendizaje pertenecen a este producto; Prisma migra únicamente su PostgreSQL                                                       |
| D-004 · JWT con sesión persistida              | En uso                              | El JWT identifica la sesión; PostgreSQL decide revocación, caducidad y rol actual                                                                         |
| D-005 · Tokens opacos de un solo uso           | En uso                              | Verificación, reset y canje OAuth almacenan SHA-256; el secreto en claro solo viaja al destinatario                                                       |
| D-006 · Verificación para comentar             | En uso                              | Leer lecciones con sesión, inscribirse y avanzar no exige verificar el correo; escribir comentarios y respuestas públicas sí                              |
| D-007 · Slugs públicos e ids de operación      | En uso                              | Los enlaces públicos usan slugs; progreso, comentarios y editor usan ids. El temario publica `lesson.id` para esas operaciones                            |
| D-008 · Totales derivados                      | En uso                              | Duración y avance se calculan sobre lecciones publicadas; no se guarda una copia del total que deba sincronizarse                                         |
| D-009 · Progreso monotónico                    | En uso                              | Un evento de reproducción atrasado no retrocede `last_position_seconds`; la guarda se ejecuta en PostgreSQL                                               |
| D-010 · Contenido público y editorial separado | En uso                              | El editor puede leer borradores; los repositorios públicos filtran publicación y separan lección bloqueada/abierta                                        |
| D-011 · Almacenamiento detrás de un puerto     | Local y S3/CloudFront implementados | MIME, firma y tamaño validados; URL canónica persistida y lectura CDN temporal firmada. Local conserva acceso público                                     |
| D-012 · Avisos sin envío masivo                | En uso                              | Guardar suscripción, agrupar demanda y marcar un corte son operaciones de datos; marcar no despacha correos                                               |
| D-013 · Certificados por finalización          | En uso                              | Se emiten en la transacción de cierre, una vez por alumno/curso; conservan los datos emitidos y se verifican públicamente por UUID y QR                   |

## Sesiones y descubrimiento de cuentas

El JWT HS256 tiene un tope absoluto de 180 días. La fila tiene una ventana por inactividad de
30 días o 12 horas, con renovación cada cinco minutos en autenticación obligatoria. Firmar el
JWT con la caducidad deslizante inicial expulsaría a una persona activa aunque su fila se hubiese
renovado. La [política de sesión](../src/modules/auth/shared/policy/session_policy.ts) limita la
renovación al mismo tope absoluto.

Logout permite reconocer una sesión ya revocada y repetir el cierre; reset revoca todas las
sesiones. El cambio de contraseña desde perfil revoca las otras y conserva la actual. El rol
ADMIN se lee desde el usuario persistido, evitando que un claim antiguo mantenga permisos.

Login desconocido y contraseña errónea comparten respuesta y ejecutan verificación Argon2;
una cuenta Google sin contraseña tiene el conflicto explícito `ACCOUNT_USES_GOOGLE`.
Recuperación comparte respuesta para correo existente y desconocido, con suelo de 400 ms.
Esto reduce señales de descubrimiento; no se presenta como una garantía matemática de tiempos.

## Catálogo y aprendizaje

Cada faceta aplica los demás filtros y omite el suyo; búsqueda no modifica contadores. La
búsqueda normalizada de catálogo se hace en memoria porque la lista actual no está paginada.
Si crece el catálogo, filtro y paginación deberán resolverse juntos en PostgreSQL.

Un curso terminado requiere al menos una lección publicada y todas las publicadas completadas.
La fecha del primer cierre se conserva; añadir contenido puede devolver el curso a «en curso».
Los contadores de directorio y resumen personal cuentan fechas de cierre persistidas, una
definición distinta de estar al día. Ver [métricas](planning/metrics/README.md).

Finalizar las lecciones y obtener el certificado son pasos separados. Los certificados nuevos
exigen aprobar un examen de 15 preguntas, con mínimo inicial de 12 aciertos (80 %), configurable
por curso desde administración. La corrección ocurre en el servidor y el intento aprobado se
guarda junto al certificado. Las versiones protegen frente a cambios de preguntas durante un
intento; los snapshots conservan qué se evaluó. Los certificados anteriores siguen siendo válidos.
Ver [exámenes](../src/modules/progress/features/exams/docs/README.md).

## Escrituras editoriales y trazabilidad

El autoguardado del curso compara `expected_updated_at`; publicar por primera vez bloquea el
slug mediante `published_at`. Archivar conserva progreso. Duplicar crea borradores y puede
compartir referencias a recursos. El editor de lecciones confirma cambios de tipo que descartan
contenido, sanea artículos y retira de publicación las ediciones que quedan incompletas.

Moderación conserva estado, fechas y actores en comentarios/reportes y emite logs de operación.
Academy no tiene las tablas de capacidades, auditoría general y recibos de comandos de Admin.
No prometer idempotencia por clave ni control optimista en todos los comandos porque exista en
el repositorio de referencia.

## Recursos y pendientes conscientes

No hay Redis, BullMQ, Socket.IO ni tareas programadas en el arranque. El rate limit es local al
proceso. El cliente Prisma no fija un pool de dos conexiones y Argon2 no tiene la cola limitada
de Admin. Medir concurrencia antes de trasladar presupuestos de otro servicio.

Quedan pendientes la configuración/verificación real de S3/CloudFront, la separación de acciones administrativas agrupadas, una
política de producción para alta inicial de administradores y la verificación real de video,
correo y almacenamiento. Los detalles y criterios están en [delivery](planning/delivery/README.md).
