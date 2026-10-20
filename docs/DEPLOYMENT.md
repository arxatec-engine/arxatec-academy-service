# Despliegue

El artefacto de Academy es `dist/server.js` con sus módulos compilados y dependencias de runtime.
Requiere Node.js >=22.12, pnpm según `packageManager` y PostgreSQL con las migraciones de este
servicio. Los comandos operativos cargan las variables con Infisical CLI, siguiendo el patrón
de Admin y el proyecto indicado en `.infisical.json`.

## Configuración del entorno

Instalar Infisical CLI y configurar su autenticación con acceso al proyecto del servicio.
En el equipo local se usa `infisical login`; el despliegue debe proporcionar autenticación
no interactiva para su entorno. Agregar las variables del backend en la raíz `/` de `prod`
según [ENV](ENV.md). `dev` usa las variables del entorno `dev` para desarrollo.
Dotenv puede cargar un `.env` local sin
reemplazar valores inyectados. No desplegar credenciales de seed ni copiar el `.env` de otra
aplicación. Mantener configuración del servidor, supervisor de procesos, certificados y secretos
en el entorno operativo correspondiente.

Como mínimo se necesitan `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `GOOGLE_CALLBACK_URL` y
`EMAIL_FROM`. En producción fijar `NODE_ENV=production`, una sal propia en
`NOTIFICATIONS_IP_HASH_SALT`, `EMAIL_TRANSPORT=smtp` y las variables `SMTP_HOST`, `SMTP_PORT`,
`SMTP_SECURE`, `SMTP_USER` y `SMTP_PASSWORD` del servidor autorizado, además de
`VIDEO_PROVIDER_DRIVER=live` cuando se editen videos reales. El arranque rechaza `log` en
producción. `EMAIL_FROM` debe usar el buzón autenticado o un alias autorizado.

Con `STORAGE_DRIVER=local`, preparar un volumen persistente escribible y la URL pública correcta.
Con `STORAGE_DRIVER=s3`, completar bucket/región, dominio HTTPS de CloudFront y su clave de firma.
El bucket debe ser privado con OAC y la distribución exigir URLs firmadas. Migrar los bytes
con sus claves antes de cambiar el driver; comprobar permisos y enlaces reales según [STORAGE](STORAGE.md).
Coordinar backups de PostgreSQL y archivos; restaurar solo uno puede dejar referencias rotas.

## Compilación y migraciones

En un directorio de release limpio y con acceso CLI al entorno `prod`:

```sh
pnpm install --frozen-lockfile
pnpm build:prod
pnpm prisma:deploy
pnpm start
```

`build` es un alias de `build:prod`; `build:dev` usa `dev`. Ambos cargan Infisical antes de
ejecutar `build:local`, que genera Prisma, compila TypeScript, reescribe aliases con `tsc-alias`
y copia las fuentes de certificados a `dist/infrastructure/certificates/assets`.
El build no limpia `dist` ni aplica migraciones. Usar un directorio limpio evita conservar
JavaScript de archivos retirados. Conservar el lockfile y las herramientas de desarrollo durante
el build. `start` inyecta las variables de `prod` al proceso compilado.

Las variantes `build:local`, `start:local`, `prisma:migrate:local` y `prisma:deploy:local`
permiten usar un entorno ya inyectado por la infraestructura o un `.env` local.

El esquema se lee de `prisma/schema`; las migraciones viven en `prisma/migrations`. El comando
`pnpm prisma:migrate` carga `dev` y usa `migrate dev`. Para un despliegue, `pnpm prisma:deploy`
carga `prod` y aplica migraciones versionadas con `migrate deploy`, después de revisar cambios y respaldo. La semilla
no es un paso de producción y aborta con `NODE_ENV=production`.

## Proxy, origen y archivos

Express configura `trust proxy` a un salto de manera fija. La topología debe corresponder a ese
valor y preservar la IP del cliente de forma confiable; no existe `TRUST_PROXY` en el esquema de
Academy. Los límites por IP dependen de ese dato.

CORS acepta el origen calculado desde `FRONTEND_URL` y solicitudes sin Origin. No es una lista
separada de múltiples dominios. El proxy termina HTTPS, reenvía las cabeceras necesarias y debe
permitir multipart de hasta 20 MiB más su envoltorio para recursos. JSON y urlencoded conservan
el límite de 1 MiB de Express.

Con driver local, `/files` sirve archivos públicos sin Bearer. Verificar que `STORAGE_PUBLIC_URL`
sea alcanzable desde el navegador y se conserve al reemplazar una release. Las filas con clave resuelven URLs desde la base vigente; las filas sin clave conservan su URL. Detalles en [STORAGE](STORAGE.md).

## Verificación tras iniciar

```sh
curl --fail --silent --show-error http://127.0.0.1:3001/ping
```

`PORT` puede cambiar 3001. `/ping` responde texto y comprueba la ruta HTTP; no consulta PostgreSQL.
No existen `/health/live` ni `/health/ready` como en Admin, ni un chequeo de base antes de escuchar.
La verificación de disponibilidad necesita además una consulta inocua al catálogo o a una sesión
de revisión autorizada. No crear cuentas ni publicar contenido solo para probar un deploy real.

Revisar acceso anónimo al catálogo, denegación administrativa sin Bearer, CORS del origen final,
lectura de archivos y entrega de correos con fixtures controladas. Google exige que callback y
origen coincidan con la configuración del proveedor. Probar reproducción desde el dominio final:
oEmbed no certifica todas las restricciones de inserción.

## Apagado, actualización y recuperación

SIGTERM/SIGINT activan el cierre en orden inverso al registro: HTTP, Prisma y transporte de correo.
Hay watchdog de diez segundos. Comprobar que el supervisor dé tiempo para completar el cierre
y que los pools no mantengan la release anterior viva.

Un rollback de código no revierte automáticamente el esquema. Revisar compatibilidad de la
release anterior con las migraciones aplicadas; los cambios de datos requieren un procedimiento
propio. No sustituir ese procedimiento por `db push`, reset o un seed contra producción.

El [informe de preparación](PRODUCTION_READINESS.md) separa lo implementado de lo que aún requiere
verificación operativa. Esta guía describe el procedimiento; no afirma que se haya desplegado.
