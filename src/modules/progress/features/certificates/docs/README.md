# Certificados de finalización

Se emite un certificado al aprobar el examen del curso, después de completar todas sus lecciones
publicadas. El examen tiene 15 preguntas y una nota mínima inicial de 12. La corrección, el
intento aprobado y el certificado se guardan en la misma transacción. Completar lecciones, por
cualquiera de sus endpoints, solo habilita el examen; no emite certificados. Ver
[exámenes](../../exams/docs/README.md).

[certificates.repository.ts](../../../shared/data/certificates.repository.ts) guarda una copia
del nombre del alumno, el título del curso y la fecha de finalización persistida. El índice único
por alumno/curso y `createMany(skipDuplicates)` evitan duplicados bajo concurrencia y preservan
la primera emisión. Cambiar el nombre, editar el curso, añadir lecciones o desmarcar una lección
no reescribe ni revoca un certificado ya obtenido. Archivar el curso tampoco impide verificarlo.
Los certificados anteriores al requisito de examen mantienen su validez; los nuevos registran
`exam_attempt_id` y la fecha del intento aprobado. No se emiten certificados retroactivos al
aplicar la migración de exámenes.

La relación con la inscripción borra el certificado al eliminar la cuenta o el curso físicamente.
Un enlace eliminado devuelve 404; los endpoints no permiten listar certificados de terceros.

## Lectura pública

| Método | Ruta bajo `/api/v1` | Respuesta |
| --- | --- | --- |
| GET | `/certificates/:id` | Sobre HTTP con `{ certificate }` |
| GET | `/certificates/:id/pdf` | PDF adjunto, sin sobre JSON |

No requieren sesión. El identificador es un UUID aleatorio, validado antes de consultar Prisma.
Un UUID desconocido devuelve `404 NOT_FOUND`; formato incorrecto, `422 VALIDATION_ERROR`.
El DTO público solo contiene `id`, `recipient_name`, `course_title`, fechas ISO `completed_at`
e `issued_at`, `verification_url` y `qr_code_data_url` (PNG). No expone correo ni ids de usuario,
curso o inscripción. Las respuestas usan `Cache-Control: no-store`.

La URL pública se construye con `FRONTEND_URL` y `/certificados/:id`, sin depender de Host ni de
datos del cliente. La descarga es `application/pdf` con `Content-Disposition: attachment`.
El PDF se genera localmente con la composición de la vista pública web: mismo logo Academy,
tipografía ArxatecSans Regular/Medium incrustada, badge, textos alineados a la izquierda y QR
vectorial a la derecha. La tarjeta de 768 puntos queda centrada sobre el fondo blanco, con
fondo `bg-card` y líneas horizontales a todo el ancho y verticales a todo el alto, formando `#`.
El alto se adapta al nombre y título, sin recortarlos; el documento
mantiene una página. `?language=es|en|pt` selecciona el idioma de la vista previa (es por defecto).
El QR y su enlace clicable
apuntan a la misma página pública. No necesita servicios externos ni almacenamiento de PDFs.

`certificate_id` (UUID o null) se incluye en las inscripciones y en ambas listas de Mis cursos;
un certificado previo sigue disponible si el alumno vuelve a tener contenido pendiente.

## Verificación

[certificates_flow.test.ts](../../../../../../tests/integration/postgres/certificates_flow.test.ts)
comprueba ambas vías de finalización, concurrencia, ausencia antes de terminar, lectura y PDF
anónimos, datos públicos acotados, preservación histórica, archivo y baja por cascada.
Los tests PostgreSQL se ejecutan exclusivamente sobre una base desechable; ver
[TESTING](../../../../../../docs/TESTING.md).
