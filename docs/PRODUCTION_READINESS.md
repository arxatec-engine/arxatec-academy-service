# Preparación de producción — revisión del 2026-10-19

Esta revisión contrasta documentación con rutas, schemas, configuración y migraciones presentes
en el árbol de trabajo. No certifica producción ni hereda los resultados de Admin. Los cambios
funcionales ya existentes, incluidos archivos aún no versionados, se describen según el código
disponible; su integración y entrega requieren sus propias verificaciones.

## Evidencia y alcance

| Área      | Evidencia disponible                                      | Qué falta demostrar                                                |
| --------- | --------------------------------------------------------- | ------------------------------------------------------------------ |
| Contratos | Rutas registradas, schemas y constantes inspeccionados    | Compatibilidad de la versión desplegada con el frontend            |
| Tests     | Suites unitarias y diez archivos de integración presentes | Ejecución completa sobre una base desechable para la release       |
| Auth      | JWT, sesión persistida, revocación y Google implementados | Recorrido Google real con credenciales y dominio finales           |
| Archivos  | Local y S3/CloudFront firmado; validación y limpieza      | Volumen persistente, backup/restauración y URLs desde el navegador |
| Correo    | Transporte log/SMTP y plantillas implementados            | Entrega y enlaces reales en el entorno final                       |
| Video     | Adaptadores Vimeo/YouTube y fake implementados            | Reproducción e inserción de cada contenido publicado               |
| Datos     | Diez directorios de migración presentes                   | Estado de migración y respaldo de la base objetivo                 |

Los comandos de una entrega están en [TESTING](TESTING.md). La implementación S3/CloudFront y sus checks se registran en [2026 W43](shipped/2026_W43.md).
La revisión documental previa permanece en [2026 W42](shipped/2026_W42.md).
No se ejecutan migraciones, seed ni pruebas que escriban sobre la base habitual para cerrar una
tarea de documentación.

## Configuración que debe revisarse para la release

- `NODE_ENV=production`, secreto JWT adecuado y estable, URLs finales de frontend/callback.
- `NOTIFICATIONS_IP_HASH_SALT` propia: el valor de desarrollo por defecto se rechaza en producción.
- `EMAIL_TRANSPORT=smtp` y credenciales de entrega; el arranque rechaza `log` en producción.
- `VIDEO_PROVIDER_DRIVER=live`; el modo fake sigue siendo aceptado por el schema y devuelve
  metadatos ficticios.
- Con local, carpeta persistente y URL alcanzable; con S3, bucket/región, IAM, dominio HTTPS,
  PEM/ID de clave, OAC y firmas exigidas en CloudFront. Ver [STORAGE](STORAGE.md).
- Proxy con topología compatible con un salto confiable y límites de subida adecuados.

Los secretos se comprueban por presencia/validez sin copiarlos a documentos ni logs. El Compose
incluido tiene credenciales fijas y puerto 5444 para desarrollo; no es configuración de producción.

## Pendientes y límites conocidos

| Tema                      | Comportamiento actual                                                       | Criterio para cerrarlo                                                                       |
| ------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| S3                        | Guardado/borrado SDK y lectura CloudFront firmada implementados             | Configurar AWS real, migrar objetos y verificar permisos, lectura y borrado                  |
| Recursos privados         | CloudFront firmado con S3; `/files` local sigue público                     | Verificar 403 sin firma/alterada/vencida, incluido caché, y renovación desde frontend        |
| Salud de base             | `/ping` no consulta PostgreSQL                                              | Verificar disponibilidad de datos por separado; un readiness futuro requiere código y prueba |
| Capacidad                 | Pool y Argon2 sin presupuesto propio acotado                                | Medir concurrencia, conexiones, memoria y saturación                                         |
| Integraciones PostgreSQL  | Consumen `DATABASE_URL`, incluyen limpieza sobre cursos sembrados           | Aprovisionar base desechable y completar el recorrido antes de publicar                      |
| Semilla                   | Reescribe fixtures y contiene referencias de video/archivos de demostración | Reemplazar contenido de ejemplo; no usar seed como alta de producción                        |
| Lectura del perfil        | GET /auth/me operativo en código; GET /me/profile no registrado             | Usar el contrato existente o implementar y probar la ruta si la requiere el consumidor       |
| Alta inicial ADMIN        | Registro público siempre crea STUDENT; seed bloquea producción              | Definir procedimiento operativo autorizado, fuera del formulario público                     |
| OAuth fallido             | Algunos fallos de callback responden JSON `500` en navegador                | Acordar y probar un retorno de error con el frontend si se cambia el contrato                |
| Estructura administrativa | Varias acciones comparten archivos                                          | Separar por acción conservando contratos y verificaciones                                    |

No se ha realizado un análisis de vulnerabilidades ni una medición de carga en esta actualización.
Se verificó conexión y autenticación SMTP en local; falta demostrar la entrega a un buzón real y
configurar el entorno de producción. No hay evidencia nueva de migración o despliegue de producción,
Google o CDN. Estos puntos
deben cerrarse con resultados reales de la release, sin marcarlos aprobados por tener una guía.

## Cierre de una release

Completar los checks de código y las integraciones en el entorno descrito, compilar desde un
directorio limpio, verificar configuración y migraciones objetivo, iniciar el artefacto y probar
las superficies acordadas con fixtures controladas. Registrar resultado y pendientes concretos
en `shipped/YYYY_Wnn.md`, sin secretos ni URLs temporales sensibles. Coordinar el frontend y
conservar una estrategia de recuperación de datos y archivos.

## Evidencia S3/CloudFront de desarrollo · 2026-10-19

Con las variables de producto se verificaron subida/lectura/borrado de fixtures S3, `/public/`
sin firma 200 y `/private/` firmado 200; privado sin firma, firma alterada y vencida devuelven 403.
El origen S3 no permite lectura anónima. Fixtures eliminados y ausencia confirmada con 404.
Esto acredita desarrollo, no producción ni migración de archivos antiguos. La respuesta CDN
no acreditó hit de caché ni habilitó CORS para el origen probado. Ver [STORAGE](STORAGE.md).
