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
