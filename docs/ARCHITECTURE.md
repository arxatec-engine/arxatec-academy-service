# Arquitectura — Arxatec Academy Service

Academy es una API REST para formación: Express 5, TypeScript estricto, Zod, PostgreSQL con
Prisma 7 y Pino. El servicio contiene catálogo, lecciones, identidad del alumno, progreso,
comunidad y administración de contenido en un mismo proceso. La estructura documental sigue
la de Admin; la implementación mantiene los contratos propios de Academy.

## 1. Stack y límites del producto

| Capa                 | Implementación                                                               |
| -------------------- | ---------------------------------------------------------------------------- |
| Runtime y paquetes   | Node.js >=22.12, pnpm fijado en `packageManager`                             |
| HTTP                 | Express 5, Helmet, CORS, cookie-parser y Multer                              |
| Lenguaje y build     | TypeScript estricto, CommonJS, aliases `@/`, `tsc` y `tsc-alias`             |
| Persistencia         | Prisma 7 con `@prisma/adapter-pg`, PostgreSQL y esquema dividido por dominio |
| Validación           | Zod en entradas, policies y mappers explícitos                               |
| Autenticación        | JWT HS256, sesiones persistidas, Passport Google OAuth 2.0                   |
| Contraseñas y tokens | Argon2id, tokens aleatorios y SHA-256 para tokens de un solo uso             |
| Correo               | Nodemailer SMTP en desarrollo y producción; transporte log solo en pruebas   |
| Archivos             | Puerto de almacenamiento, local y S3 con CloudFront firmado                  |
| Video                | Puerto oEmbed con adaptadores Vimeo, YouTube y fake                          |
| Pruebas              | Jest, SWC, Supertest y PostgreSQL real para integración                      |

Academy tiene una base propia y roles STUDENT/ADMIN de producto. No utiliza workspaces,
pertenencias multi-tenant, créditos, facturación ni una conexión lectora a Lawyer. El arranque
no incorpora Redis, BullMQ, Socket.IO, workers o cron.

## 2. Mapa del repositorio

```text
src/
├── server.ts                    # HTTP, registro de recursos y cierre ordenado
├── app/create_app.ts            # composición de Express
├── config/                      # env, logger, Prisma, email y Passport
├── constants/                   # endpoints, políticas, códigos, mensajes y claves i18n
├── generated/                   # cliente Prisma generado; no editar
├── infrastructure/
│   ├── email/                   # puerto de entrega, enlaces y plantillas
│   ├── jwt/                     # firma y validación del token de sesión
│   ├── password/                # Argon2id
│   ├── tokens/                  # tokens opacos y hash
│   ├── storage/                 # puerto, validación y adaptadores
│   └── video/                   # probe y adaptadores de proveedor
├── middlewares/                 # identidad, permisos, límites, uploads y errores
├── modules/
│   ├── auth/                    # registro, login, sesión, reset, verificación, Google
│   ├── courses/                 # catálogo, lectura y edición de cursos/lecciones
│   ├── progress/                # inscripción, avance, Mis cursos y certificados públicos
│   ├── comments/                # hilos, respuestas, reportes y moderación
│   ├── user/                    # perfil, cuenta, directorio y CSV
│   └── notifications/           # avisos, temas y gestión administrativa
├── routes/index.ts              # composición bajo /api/v1
├── seed/                        # fixtures de desarrollo
├── types/                       # identidad y ampliación de Express
└── utils/                       # respuestas, errores, CSV, fechas y normalización

prisma/schema/                   # _base, enums y modelos de dominio
prisma/migrations/               # historial SQL de Academy
config/jest/                     # configuración compartida e integración
tests/integration/postgres/      # flujos transversales con base real
scripts/                        # citas documentales y smoke HTTP
docs/                           # guías, alcance por área y entregas
```

## 3. Arranque y cadena HTTP

[createApp](../src/app/create_app.ts) monta las piezas en este orden:

| Orden | Pieza                             | Propósito                                              |
| ----- | --------------------------------- | ------------------------------------------------------ |
| 1     | `trust proxy = 1`                 | Resolver la IP con una topología de un salto confiable |
| 2     | Helmet y request id               | Cabeceras y correlación antes de responder             |
| 3     | cookie-parser, logger y CORS      | Estado OAuth, log HTTP y origen de frontend            |
| 4     | JSON y urlencoded, 1 MiB cada uno | Construir el body antes de límites que usan el correo  |
| 5     | Passport initialize               | Habilitar la estrategia Google sin sesiones Passport   |
| 6     | `GET /ping`                       | Comprobar respuesta HTTP, sin consulta de base         |
| 7     | `/files`                          | Servir la carpeta pública con driver local             |
| 8     | Routers                           | Montar rutas públicas, alumno y administración         |
| 9     | 404 y error handler               | Convertir errores en el contrato HTTP común            |

CORS deriva un origen de `FRONTEND_URL`; no sustituye Bearer ni `requireAdmin`.
El middleware de archivos estáticos no autentica descargas. La estrategia Google se registra
al utilizarse y falla si faltan sus credenciales, sin bloquear el login por contraseña al arrancar.

[server.ts](../src/server.ts) registra transporte de correo, Prisma y HTTP como recursos
cerrables. SIGTERM/SIGINT los cierra en orden inverso: HTTP, Prisma y correo, con watchdog de
10 segundos. Las excepciones no controladas también activan el cierre. No existe una ruta
readiness que consulte PostgreSQL ni una comprobación de base antes de `listen`.

## 4. Slices y responsabilidades

```text
modules/<module>/features/<feature>/<action>/
├── domain/          # schema Zod, payload, tipos y reglas locales
├── data/            # persistencia propia, cuando corresponde
├── presentation/    # rutas, controller y service
├── docs/README.md   # contrato, porqué, invariantes y evidencia
├── test/            # tests de la unidad
└── utils/           # solo si el helper pertenece a esta acción
```

El recorrido es `router → middleware → controller → schema → service → repository → Prisma`.
Controllers conocen Express y construyen respuestas; services reciben datos tipados y aplican
reglas; repositories seleccionan columnas y escriben; las políticas puras definen decisiones
reutilizables. Las integraciones de correo, almacenamiento y video viven tras puertos.

Auth, lectura de catálogo, progreso y perfil tienen acciones separadas. Las features
administrativas y notifications aún agrupan varias acciones en archivos de presentación; se
registran como implementadas con deuda de estructura, no como una separación ya completada.

| Alcance compartido            | Ubicación                     | Ejemplo                                                  |
| ----------------------------- | ----------------------------- | -------------------------------------------------------- |
| Una acción                    | La propia acción              | Hash señuelo de login, suelo de recuperación             |
| Varias acciones de un dominio | `modules/<module>/shared`     | Sesiones, referencias de cursos, repositorio de progreso |
| Infraestructura transversal   | `infrastructure`              | Envío de correo, archivo local, probe externo            |
| Helpers sin negocio de módulo | `utils`, `constants`, `types` | Sobre HTTP, CSV y códigos de error                       |

Dependency-cruiser verifica ciclos, imports privados entre módulos, runtime hacia tests,
constants hacia runtime y utils hacia módulos. No prueba por sí solo todas las reglas de diseño:
por ejemplo, no hay una regla general que detecte cada uso de Express en un service.

## 5. Identidad y sesiones

El JWT incluye `sub`, `jti`, `role`, `iat`, `exp` e `iss`. Su firma HS256 valida el portador,
pero cada petición autenticada consulta `auth_sessions` y su usuario. Se comprueba coincidencia
entre `sub` y usuario, revocación y caducidad. El rol efectivo y la verificación de correo vienen
de PostgreSQL, por lo que un claim anterior no conserva permisos retirados.

La ventana por inactividad es 30 días con `remember_me=true` y 12 horas con `false`. La
renovación obligatoria se limita a una escritura cada cinco minutos. El JWT vence a los 180 días
desde la creación; la ventana deslizante nunca supera ese tope. `optionalAuthenticate` reconoce
una sesión válida, pero no la renueva; un Bearer inválido se trata como anónimo en esas rutas.

Logout utiliza el autenticador que tolera sesión revocada para repetir el cierre. Reset consume
el token, cambia contraseña, verifica el correo si faltaba y revoca todas las sesiones dentro
de una transacción. El cambio desde perfil conserva la sesión actual y revoca las otras.

Los secretos de verificación, reset y canje Google se guardan hasheados y se consumen con una
escritura condicionada a no estar usados. Google utiliza state firmado y cookie de nonce;
redirige un código opaco de 60 segundos al frontend, nunca el JWT en la URL.

## 6. Contenido, acceso y publicación

El catálogo solo consulta cursos publicados. La ficha presenta metadatos y temario publicado,
incluido `lesson.id`; la lección abierta entrega video/artículo, transcripción y recursos.
Sin sesión se puede leer una muestra gratuita; con sesión se leen las publicadas sin exigir
inscripción ni correo verificado. Un contenido bloqueado devuelve `403 LESSON_LOCKED` con
metadatos públicos, sin consultar el contenido abierto. Borradores y cursos archivados no se
revelan en lecturas públicas por slug.

El editor administrativo usa otros selects y requiere ADMIN. El curso controla autoguardado
con `expected_updated_at`; su primera publicación sella `published_at` y bloquea slug. El orden
se escribe como conjunto completo de ids activos. Publicar exige una lección publicada y
ambas descripciones. Archivar retira del catálogo sin borrar progreso; duplicar copia borradores.

Las lecciones separan VIDEO/ARTICLE. Cambiar tipo limpia columnas incompatibles y puede exigir
confirmación. El servidor sanea HTML y calcula palabras/minutos; al quedar incompleta una
lección publicada, vuelve a borrador. Vimeo aporta duración; YouTube requiere duración manual
positiva porque oEmbed no la devuelve. Ver [lecciones](planning/lessons/README.md).

## 7. Persistencia y transacciones

[prisma.config.ts](../prisma.config.ts) define `prisma/schema`, migraciones y semilla.
El cliente generado usa CommonJS en `src/generated`. Hay un único `PrismaPg`; no se configura
un presupuesto explícito de pool, consulta o admisión como en Admin.

El [mapa de datos](planning/data_model/README.md) explica índices, relaciones y cascadas. El
progreso garantiza una fila por usuario/lección, inserta con conflicto ignorado y actualiza
solo si avanza la posición. Completar agrupa marcado, inscripción y primer cierre en una
transacción. La regla pura de finalización se llama desde el repositorio dentro de esa unidad
para no sacar la decisión fuera del momento de escritura.

La baja usa el mismo cliente transaccional al borrar progreso, borrar comentarios propios,
retirar artefactos de auth y borrar usuario. El avatar se limpia después. Las funciones de
otros módulos se consumen mediante su `shared`; una llamada con cliente global dentro de ese
flujo perdería atomicidad.

La deuda de auth sigue siendo que varias acciones gestionan `auth_tokens` desde sus propios
repositorios. Consolidarlo requiere preservar consumo único y límites transaccionales, junto
con los mocks por path de esas acciones.

## 8. Comunidad, usuarios y avisos

El hilo público tiene un nivel de respuestas y autores sin correo. La insignia de equipo se
deriva del rol actual. Escribir comentario/respuesta pública exige sesión y correo verificado;
reportar exige sesión y deduplica por usuario/comentario. Ocultar una raíz retira el hilo de la
proyección pública. Moderación persiste estado, actor y fechas sin introducir un sistema de
auditoría genérica equivalente al de Admin.

Perfil modifica campos permitidos, sin correo ni rol. Directorio proyecta identidad y cierre de
cursos, con filtros y CSV. Sus estadísticas globales no se limitan a la búsqueda; la paginación
vive en `meta.pagination`, mientras moderación y avisos la devuelven dentro de `data`.

Avisos aceptan correo anónimo o el de la sesión. Una migración añade un índice parcial para
el aviso general con `course_id IS NULL`; el índice único compuesto no bastaría para ese caso.
Los pedidos de tema agrupan demanda normalizada. Marcar avisados no envía correo. La IP se
persiste como hash con sal en esas tablas.

## 9. Errores, logs y archivos

`buildHttpResponse` entrega status, message, description, timestamp y path, con data/meta cuando
aplican. `AppError` añade código estable y datos opcionales de confirmación. Zod se traduce a
`422 VALIDATION_ERROR` con claves i18n; errores inesperados a `500 INTERNAL_ERROR`. CSV, OAuth y
204 tienen transporte propio. Detalles y excepciones en [API](API.md).

Pino serializa la petición sin query y la respuesta sin cabeceras para evitar códigos OAuth
en logs HTTP. El transporte de correo log solo se admite en pruebas e incluye el texto del correo;
tratar ese log como sensible. Desarrollo y producción exigen SMTP.

Los archivos se validan por uso, MIME, firma y tamaño. El driver local sirve URLs públicas;
S3 usa un origen privado y URLs CloudFront firmadas al responder. La DB conserva URL canónica
y clave interna; las filas con clave resuelven sobre la base vigente. Las respuestas API usan
`private, no-store`. El acceso a los recursos se decide antes de firmar. Ver [STORAGE](STORAGE.md).

## 10. Verificación y evolución

[TESTING](TESTING.md) define los comandos y el aislamiento de PostgreSQL: la suite usa
`DATABASE_URL` y requiere seed en una base desechable. [PERFORMANCE](PERFORMANCE.md) documenta
las búsquedas y exportaciones que materializan conjuntos completos, sin inventar mediciones.

Toda evolución debe mantener contrato, README del área, [decisiones](DECISIONS.md), entorno si
cambia y [registro de entrega](shipped/README.md). La revisión de producción conserva pendientes
explícitos; una estructura documental completa no implica que esos pendientes estén resueltos.
