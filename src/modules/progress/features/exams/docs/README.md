# Exámenes para certificados

Cada curso puede configurar un examen de exactamente 15 preguntas, con cuatro opciones
distintas y una respuesta correcta por pregunta. La nota mínima inicial es 12 (80 %);
administración puede editarla y activar o desactivar el examen. Guardar exige las 15 preguntas
completas. `expected_version` evita sobrescribir otra edición; cada guardado incrementa la versión.

| Método | Ruta bajo `/api/v1`            | Acceso                                |
| ------ | ------------------------------ | ------------------------------------- |
| GET    | `/admin/courses/:id/exam`      | ADMIN, incluye respuestas correctas   |
| PUT    | `/admin/courses/:id/exam`      | ADMIN, configuración completa         |
| GET    | `/courses/:slug/exam`          | Sesión, solo curso publicado          |
| POST   | `/courses/:slug/exam/attempts` | Sesión, 5 envíos por minuto y usuario |

GET del alumno devuelve `data.exam`: curso, estado `unavailable|locked|ready|passed`, versión,
cantidad, nota mínima, preguntas, certificado y último resultado. Solo `ready` entrega preguntas;
ninguna respuesta del alumno incluye `correct_option`. Se exige inscripción finalizada y todas
las lecciones publicadas completadas; una lección añadida o desmarcada impide rendir el examen.

POST acepta únicamente `{ version, answers }`, con 15 índices enteros entre 0 y 3. El servidor
calcula la nota con la clave de esa versión. Un cambio de versión responde `409 EXAM_CHANGED`;
un examen desactivado, `409 EXAM_UNAVAILABLE`; progreso incompleto, `403 EXAM_LOCKED`.
Se guarda cada intento válido con preguntas, respuestas, versión, nota mínima y resultado como
histórico interno. El DTO de resultado contiene solo nota, aprobado, mínimo, total y certificado.

La transacción bloquea la configuración y la inscripción mientras corrige y guarda el intento.
Al aprobar llama a `issueCourseCertificate`, que exige un intento aprobado del mismo usuario y
curso; `certificates.exam_attempt_id` registra esa prueba. Intento y certificado se confirman
juntos. Dos envíos simultáneos devuelven el mismo certificado; reenviar tras aprobar no crea
otro intento. Completar una lección ya no emite certificados.

Editar o desactivar el examen no reescribe certificados ni intentos previos. Los certificados
anteriores mantienen `exam_attempt_id: null` y siguen siendo públicos. La fecha de finalización
de un certificado nuevo corresponde al intento aprobado. La baja de cuenta borra los intentos
y certificados por cascada. No se almacenan claves correctas en el navegador del alumno ni en progreso local.

La migración es aditiva. Las pruebas de dominio cubren 11/12 aciertos y entradas inválidas;
las pruebas PostgreSQL comprueban permisos, progreso, versiones, reintentos, concurrencia,
preservación del histórico, verificación pública, PDF y borrado por cascada.
