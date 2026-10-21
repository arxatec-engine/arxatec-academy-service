# Semillas de desarrollo

`index.ts` valida el entorno y las credenciales, prepara usuarios y cursos y después ejecuta
la semilla de avisos. Los datos y comandos disponibles se describen en
[TESTING](../../../docs/TESTING.md); los requisitos de entorno, en [ENV](../../../docs/ENV.md).

`seed_notifications.ts` genera suscripciones generales y por curso, de estudiantes y visitantes,
con ambos estados de aviso. Los temas usan la misma normalización que las solicitudes públicas.
La selección de estudiantes y cursos se ordena antes de generar los registros, y sus IDs dependen
del correo y del curso o tema normalizado para mantenerse estables entre ejecuciones.

La restricción única de correo y curso permite varias filas cuando `course_id` es nulo.
Por eso se consultan primero las suscripciones existentes y se comparan ambas claves antes de
insertar. Las altas y solicitudes faltantes se escriben en una transacción con `skipDuplicates`;
los estados de aviso y contadores existentes se conservan. El seed no envía correos.

Las pruebas de [seed_notifications](../test/seed_notifications.test.ts) cubren la variedad de
datos, las identidades estables y la conservación de una suscripción general existente.

## Exámenes de los cursos

`seed_exam_questions.ts` contiene preguntas relacionadas con los seis cursos de ejemplo.
`buildSeedExams` valida cada examen con el mismo schema que administración: 15 preguntas,
cuatro alternativas distintas y una respuesta correcta por pregunta. Las posiciones correctas
se distribuyen entre las cuatro opciones, salvo «Automatiza tus escritos»: sus 15 respuestas
correctas están en A (índice 0), configurado en `seedExamFixedCorrectOptions`, para facilitar
las pruebas del flujo de aprobado. Los textos de las opciones se reordenan con su clave para
mantener correcta la respuesta. Los exámenes nuevos quedan habilitados y requieren
12 aciertos para aprobar. Completar lecciones permite rendirlos; el certificado se emite al aprobar.

La semilla general incorpora estos exámenes después de guardar los cursos. Para agregar solo
los exámenes faltantes a cursos ya existentes, ejecutar:

```sh
pnpm seed:exams
```

`seed` y `seed:exams` cargan el entorno `dev` de Infisical. Para una base desechable con
`DATABASE_URL` ya exportada o un `.env` local, usa `seed:local` y `seed:exams:local`; así la
configuración de Infisical no sustituye la base elegida para la prueba.

Ese comando no necesita contraseñas SEED: consulta los slugs de ejemplo y usa createMany con
skipDuplicates para conservar exámenes/versiones/respuestas que ya haya guardado administración.
No crea cursos ausentes ni modifica usuarios, lecciones, progreso, intentos o certificados.
Se bloquea en producción igual que la semilla general. Los cursos personalizados no reciben
preguntas genéricas de otro curso.

En desarrollo se verificaron seis altas y una segunda ejecución con cero altas y seis
configuraciones conservadas. Las pruebas validan cobertura de cursos, schema, calificación,
distribución de alternativas, aprobado con todas las respuestas A en el curso de automatización
y persistencia sin sobrescritura.
