# Administración de lecciones, recursos y video

Las rutas de este feature cubren temario del curso, edición de una lección, orden, publicación,
recursos y `POST /admin/videos/probe`. Los tres routers se protegen con sesión y rol `ADMIN`.
El service devuelve borradores completos al editor; la API pública conserva su propio `select`
y control de acceso.

Cambiar entre ARTICLE y VIDEO borra las columnas del tipo anterior. Si había contenido, el
cliente debe mandar `confirm_type_change: true`; de otro modo recibe
`LESSON_TYPE_CHANGE_NOT_CONFIRMED` con `will_discard`. Campos rezagados del tipo opuesto no se
persisten. Si una lección publicada pierde contenido obligatorio por este guardado, vuelve a
`DRAFT`; hace falta publicarla de nuevo tras completarla. El HTML de artículos se sanea y se
recalculan palabras/minutos en el servidor.
El probe se despacha por `video_provider`. Vimeo conserva la duración calculada por el proveedor
y descarta la del cliente. YouTube se comprueba con oEmbed, que no devuelve duración: para
`YOUTUBE` el administrador envía `duration_seconds` positivo al guardar y sin él no se publica.
Si se añade un ID a una lección nueva sin proveedor, se elige `YOUTUBE`. Cambiar proveedor o ID
vuelve a consultar el adaptador; cambiar solo título no. El modo `fake` evita red en desarrollo
y tests. Los ID de Vimeo del seed histórico son placeholders, no videos reales; deben reemplazarse
antes de ofrecer esas lecciones a alumnos. El probe de YouTube no sustituye una prueba manual
de reproducción en el dominio final.

El orden de lecciones y recursos exige una lista completa de ids. Borrar una lección publicada
se rechaza; si hay progreso o comentarios, una lección borrador exige confirmación explícita.
Los archivos de recursos tienen clave privada y solo se retiran cuando no quedan referencias
(un curso duplicado puede compartirlos).
La transacción registra los archivos desprendidos mediante triggers de PostgreSQL, también
al borrar una lección en cascada. La limpieza intenta borrar de S3 o local inmediatamente;
si falla, el worker de almacenamiento reintenta desde una cola persistente tras reinicios.

La integración PostgreSQL está en `tests/integration/postgres/admin_lessons_flow.test.ts`; el
smoke con `curl` prueba ARTICLE, VIDEO, probe, reordenación y subida de PDF.

Pendiente estructural: separar los controller/service agrupados en directorios por action y
documentarlos individualmente, tal como exige el harness.
