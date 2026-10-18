# Pruebas y verificación

Academy usa Jest 30 con `@swc/jest` y Supertest. Los comandos disponibles son los de
[package.json](../package.json); esta guía no presupone scripts `:local`, Infisical ni el runner
nativo de Node usados por Admin. Las pruebas PostgreSQL escriben datos y requieren un entorno
desechable propio.

## Verificaciones de una entrega

Desde la raíz del servicio, con dependencias instaladas y Prisma generado:

```sh
pnpm prisma:generate
pnpm lint
pnpm typecheck
pnpm typecheck:tests
pnpm boundaries
pnpm docs:citations
pnpm test
pnpm test:integration:postgres
pnpm build
pnpm exec prettier --ignore-path /dev/null --check 'docs/**/*.md'
```

Ejecutar integración solo después de preparar el entorno descrito más abajo. Una modificación
exclusiva de Markdown se comprueba con formato, enlaces y citas; no requiere sembrar datos ni
volver a ejecutar operaciones del producto. `.prettierignore` omite Markdown por defecto;
`--ignore-path /dev/null` hace que el check anterior sí revise estos documentos.
No registrar los otros comandos como aprobados si
no se ejecutaron.

| Comando                     | Qué comprueba                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `lint`                      | Reglas ESLint sobre `src`                                                                       |
| `typecheck`                 | TypeScript de la aplicación sin emitir archivos                                                 |
| `typecheck:tests`           | Incluye tests excluidos del tsconfig de runtime                                                 |
| `boundaries`                | Ciclos, imports privados entre módulos y dependencias prohibidas                                |
| `docs:citations`            | Existencia y rango de referencias `archivo:línea`; no valida enlaces Markdown ni su significado |
| `test`                      | Archivos `src/**/*.test.ts`, en serie                                                           |
| `test:integration:postgres` | Archivos `tests/integration/postgres/**/*.test.ts`, en serie                                    |
| `build`                     | Compilación CommonJS y reescritura de aliases; no genera Prisma ni aplica migraciones           |

## Unitarios y tests HTTP de slice

La configuración está en [jest.config.cjs](../jest.config.cjs) y
[jest.base.cjs](../config/jest/jest.base.cjs). Los tests cercanos al código cubren schemas,
políticas puras, mappers, servicios con colaboradores sustituidos y controllers con router real.
No necesitan un PostgreSQL operativo cuando sus dependencias están correctamente mockeadas.

Algunos imports cargan la configuración global. Si se ejecutan sin `.env`, proporcionar los
campos obligatorios de [ENV](ENV.md) con valores ficticios de test; definir una URL PostgreSQL
inutilizada no significa iniciar una base. No usar credenciales reales para completar un mock.

Para una comprobación concreta puede usarse, por ejemplo:

```sh
pnpm test --runTestsByPath src/modules/courses/shared/test/lesson_access.test.ts
pnpm test --runTestsByPath src/utils/test/csv.test.ts
```

SWC transforma los tests, pero no sustituye el typecheck. Los mocks deben usar el mismo
especificador que importa la implementación; un barril distinto puede inicializar Prisma o
dejar una dependencia real activa.

## Preparación de PostgreSQL de integración

La suite **no consume `TEST_DATABASE_URL`** ni verifica que la base sea distinta de desarrollo.
Importa el mismo cliente de la aplicación, que lee `DATABASE_URL`. Dotenv completa variables
desde `.env` sin reemplazar las ya exportadas. Exportar solo `TEST_DATABASE_URL` dejaría los tests
apuntando a la URL habitual.

Preparar previamente una base desechable, por ejemplo `arxatec_academy_test`, con una identidad
que pueda aplicar las migraciones y escribir fixtures. El Compose del repositorio crea
`arxatec_academy`; no crea automáticamente esa segunda base.

En una terminal dedicada, reemplazando la URL de ejemplo por la de esa base desechable:

```sh
export NODE_ENV=test
export DATABASE_URL='postgresql://test_user:test_password@127.0.0.1:5444/arxatec_academy_test?schema=public'
export JWT_SECRET='academy-test-only-secret-at-least-32-characters'
export JWT_ISSUER='arxatec-academy'
export FRONTEND_URL='http://localhost:5173'
export GOOGLE_CALLBACK_URL='http://localhost:3001/api/v1/auth/google/callback'
export EMAIL_FROM='Academy Tests <no-reply@example.test>'
export EMAIL_TRANSPORT=log
export VIDEO_PROVIDER_DRIVER=fake
export STORAGE_DRIVER=local
export STORAGE_LOCAL_PATH="$(mktemp -d /tmp/academy-test-storage.XXXXXX)"
export SEED_ADMIN_EMAIL='admin-seed@example.test'
export SEED_ADMIN_PASSWORD='solo-pruebas-admin-2026'
export SEED_STUDENT_EMAIL='student-seed@example.test'
export SEED_STUDENT_PASSWORD='solo-pruebas-student-2026'
pnpm prisma:generate
pnpm exec prisma migrate deploy
pnpm seed
pnpm test:integration:postgres
```

Esos valores de contraseña son fixtures públicas para una base desechable. La semilla es necesaria:
progreso, comentarios y cuenta buscan el curso `fundamentos-de-legal-tech` y sus lecciones.
No es una carga puramente aditiva: actualiza usuarios/cursos y reconstruye recursos.

En una base vacía crea 36 usuarios (un administrador y 35 estudiantes), 6 cursos y 55 lecciones
de video de YouTube.
`fundamentos-de-legal-tech` tiene 30 lecciones. Los videos reutilizan tres clips públicos de
muestra para probar el reproductor; sus títulos y duraciones describen las clases de ejemplo.
Los dos artículos anteriores se conservan como transcripciones de sus respectivas clases.
Los 34 alumnos adicionales usan correos `@seed.arxatec.test` y la contraseña
`SEED_STUDENT_PASSWORD`, con perfiles de Lima, Arequipa y Trujillo, independientes y de
distintos estudios. El directorio supera una página con el tamaño predeterminado de 25 usuarios.

Los avisos incluyen 60 suscripciones: 30 al catálogo general y 30 repartidas entre los seis
cursos, con 30 pendientes y 30 ya avisadas. Participan 24 alumnos y seis visitantes con
correos `visitante01@seed.arxatec.test` a `visitante06@seed.arxatec.test`. También se crean 50
solicitudes agrupadas en diez temas, con varios correos y contadores por tema. Estos datos
permiten revisar filtros, paginación, CSV, marcado y borrado de direcciones desde administración.
La semilla de avisos solo inserta registros faltantes; conserva los estados y contadores
existentes, y reconoce las suscripciones generales por correo aunque `course_id` sea nulo.

También crea 545 hilos y 1788 respuestas, con intervenciones del equipo, conversaciones entre
alumnos y preguntas pendientes. Los comentarios tienen identificadores estables: volver a
ejecutar la semilla no los duplica y conserva los comentarios añadidos manualmente en las
lecciones que permanecen en el temario.

La limpieza de comentarios borra comentarios de las lecciones de prueba seleccionadas, y algunos
flujos cambian temporalmente el estado del curso sembrado. No basta afirmar que «cada test borra
solo su usuario». Nunca ejecutar esta suite sobre contenido de alumnos o una base compartida.
Eliminar el entorno y su carpeta temporal al terminar, siguiendo el procedimiento de quien lo
provisionó; no usar `db reset` sobre la conexión habitual.

## Cobertura de integración existente

| Archivo en `tests/integration/postgres` | Comportamiento que comprueba                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `auth_flow.test.ts`                     | Registro, verificación y segundo clic, logout repetido, login, reset y revocación; exclusión de hash |
| `progress_flow.test.ts`                 | Inscripción repetida, avance concurrente máximo, completar/desmarcar y cambio de temario             |
| `comments_flow.test.ts`                 | Verificación para escribir, autor público sin correo, equipo, reportes, visibilidad y rate limit     |
| `account_flow.test.ts`                  | Perfil, contraseña y otras sesiones, avatar, resumen y baja transaccional                            |
| `admin_access_control.test.ts`          | Matriz de rutas administrativas sin sesión y con rol STUDENT                                         |
| `admin_courses_flow.test.ts`            | Borrador, autoguardado obsoleto, publicación, slug, duplicado y archivo                              |
| `admin_lessons_flow.test.ts`            | Edición ARTICLE/VIDEO, recursos, publicación, orden y confirmaciones                                 |
| `admin_moderation_flow.test.ts`         | Respuesta del equipo, reportes y estados observados desde la API pública                             |
| `admin_users_flow.test.ts`              | Filtros de directorio y exportación                                                                  |
| `notifications_flow.test.ts`            | Deduplicación, demanda agrupada, CSV, marcado y eliminación                                          |

La existencia de un archivo no prueba que haya pasado en una máquina concreta. Registrar
comando, entorno no sensible, resultado y límites de la ejecución en [shipped](shipped/README.md).
Las pruebas con correo mockeado y video fake no certifican SMTP, Google ni reproducción real.

## Smoke del servidor compilado

[smoke_backend.sh](../scripts/smoke_backend.sh) arranca `dist/server.js`, usa `curl`/`jq`, crea
cuenta, curso y archivos temporales y recorre superficies públicas, de alumno y administrativas.
Requiere una base desechable migrada y sembrada, `curl`, `jq`, `rg`, Node y pnpm.
Compilar después de generar Prisma y ejecutar con la misma `DATABASE_URL` de prueba:

```sh
pnpm build
SMOKE_ALLOW_MUTATION=1 VIDEO_PROVIDER_DRIVER=fake bash scripts/smoke_backend.sh
```

El puerto por defecto es 3109 (`SMOKE_PORT` lo cambia). El script usa `SEED_ADMIN_*`, guarda
temporalmente el log para recuperar el token de verificación y limpia artefactos al salir.
El permiso `SMOKE_ALLOW_MUTATION=1` es un freno explícito; no verifica por sí mismo la identidad
de la base. No publicar sus logs ni usarlo como comprobación contra producción.
