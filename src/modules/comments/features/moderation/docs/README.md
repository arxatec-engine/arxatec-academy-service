# Moderación de comentarios

`moderation.routes.ts` protege todas las rutas con `authenticateTokenJwt` y `requireAdmin`; las
escrituras tienen un limitador por usuario. El listado ofrece pestañas `recent`, `reported` y
`hidden`, y los contadores separan pendiente/reportado. Responder como equipo usa el mismo
modelo de comentarios que el hilo público. Ocultar cambia el estado y revisa los reportes;
el endpoint público deja de mostrar el comentario y su hilo. Borrar es lógico para preservar
la trazabilidad y no se repite sobre un comentario ya borrado.

Los datos de reporte se añadieron por migración, con select explícito en
`shared/data/moderation.repository.ts`. `tests/integration/postgres/admin_moderation_flow.test.ts`
verifica estado HTTP y visibilidad pública. El smoke con `curl` hace respuesta, reporte y
ocultación sobre un comentario recién creado.

Pendiente estructural: un directorio/README por action; hoy la presentación está agrupada.
