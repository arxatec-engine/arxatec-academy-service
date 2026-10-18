# Estilo de código

Academy comparte la separación de responsabilidades de Admin y Lawyer. Las convenciones se
aplican a su configuración real: TypeScript estricto, módulos CommonJS y aliases `@/`.
Fuentes: [tsconfig](../tsconfig.json), [ESLint](../eslint.config.mjs),
[Prettier](../.prettierrc) y [dependency-cruiser](../.dependency-cruiser.cjs).

## Organización y nombres

- La unidad preferida es `modules/<module>/features/<feature>/<action>/` con `domain`,
  `presentation`, `data` cuando tiene persistencia propia, `docs/README.md` y `test`.
- Carpetas y archivos usan `snake_case`: `get_list`, `update_password`, `course_mapper`.
  Los archivos de acción llevan su capa: `register.schema.ts`, `register.service.ts`,
  `register.controller.ts`, `register.routes.ts` y `register.repository.ts`.
- Tipos, interfaces y schemas exportados siguen el nombre existente en su unidad; funciones
  y variables usan `camelCase`. Los campos persistidos y los DTO HTTP usan `snake_case`.
- Usar exports con nombre e imports directos. El código actual importa `@/utils/errors`, sin
  añadir `.js`: el build CommonJS reescribe los aliases con `tsc-alias`.
- `modules/<module>/shared` publica datos, dominio y políticas usados por varias features.
  No importar la implementación privada de otro módulo ni crear un contenedor global de negocio.

Algunas features administrativas agrupan acciones en un único controller/service. Es deuda
estructural existente, no el patrón recomendado para nuevas acciones. Separarlas requiere
conservar sus rutas y contratos; esta actualización documental no hace esa refactorización.

## Responsabilidades

| Pieza          | Responsabilidad                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| Router         | Encadenar autenticación, autorización, límites, multipart y controller                 |
| Controller     | Obtener identidad del servidor, validar entradas, invocar el service y traducir a HTTP |
| Service        | Aplicar reglas y coordinar repositorios/puertos con datos tipados, sin Express         |
| Repository     | Consultas, selects, orden y escrituras transaccionales de su dominio                   |
| Domain/policy  | Schemas, payloads, mappers y reglas puras                                              |
| Infrastructure | Criptografía, correo, almacenamiento y adaptadores externos                            |

Los controllers asíncronos dejan subir los errores al manejador de Express 5. Un `try/catch`
solo se justifica para una recuperación concreta: conflicto único, limpieza de un archivo o
fallo tolerado de correo. No repetir el manejador HTTP dentro de cada slice.

## Tipos, validación y seguridad del contrato

TypeScript es estricto. Evitar `any`, `@ts-ignore` y casts que oculten un contrato desconocido;
validar datos externos antes de utilizarlos. Inferir payloads desde Zod y construir DTOs con
selects y mappers explícitos, sin devolver filas completas de Prisma.

Los schemas existentes suelen usar `z.object`, que elimina claves desconocidas. No describirlos
como estrictos ni prometer rechazo de campos extra sin usar y probar esa configuración. En
perfil, el controller construye los campos permitidos y toma `user_id` de la sesión.

Las contraseñas se conservan exactamente, sin trim ni normalización. El correo se normaliza con
la utilidad/schema de email; la búsqueda sin acentos usa su normalizador específico. El HTML
de un artículo se sanea con su política; el comentario se trata como texto plano.

## Respuestas y errores

Usar `HttpStatusCodes`, constantes de mensajes y `ErrorCodes`. El contrato JSON pasa por
`buildHttpResponse({ status, description, path, data?, meta? })`; la decisión del cliente usa
`meta.code`, y la validación de campos usa claves i18n en `meta.fields`.

Los errores esperados usan `AppError`; admite `data` para detalles de confirmación. La lección
bloqueada es un resultado tipado que el controller traduce a `403` con datos públicos. CSV,
redirecciones OAuth y respuestas `204` conservan su transporte específico.

## Formato, pruebas y documentación

Dos espacios, punto y coma, comillas simples, ancho 100, coma final y LF. No usar `console.log`
en runtime. Las explicaciones de decisiones viven en Markdown junto a la unidad y en
[DECISIONS](DECISIONS.md), con enlaces a código real.

Los tests de slice viven junto al código; las integraciones PostgreSQL en `tests/integration`.
Mockear el especificador exacto que importa la implementación. Las comprobaciones están en
[TESTING](TESTING.md). Al cambiar un contrato, actualizar API, variables si corresponde, el
README del área y la entrega semanal; no sustituir evidencia por una afirmación de «listo».
