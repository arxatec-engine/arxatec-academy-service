# Configuración del examen

`GET /admin/courses/:id/exam` requiere ADMIN y devuelve `{ exam }`, nullable si el curso no
tiene configuración. Incluye versión, activación, mínimo, 15 preguntas y sus respuestas correctas.
Valida que el curso exista y responde sin caché; esta clave nunca se reutiliza en el DTO del alumno.
