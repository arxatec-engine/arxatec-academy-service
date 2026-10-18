# Avisos y pedidos de tema

Las dos rutas públicas permiten correo explícito o sesión opcional; si hay sesión, el correo
se toma de la cuenta. Ambas tienen límites por IP y correo. El alta de aviso es idempotente por
correo y curso (o catálogo general); pedir el mismo tema normalizado incrementa su contador.
La IP se guarda únicamente como hash con `NOTIFICATIONS_IP_HASH_SALT`.

El router administrativo exige sesión y rol `ADMIN` y ofrece listado/exportación de avisos,
marcación de los anteriores a un corte, temas agrupados y borrado de una dirección en ambas
tablas. El marcado no envía correos: el envío masivo está fuera del alcance acordado. El CSV
usa BOM y protección contra fórmulas. `tests/integration/postgres/notifications_flow.test.ts`
cubre idempotencia, exportación, marcado y borrado; el smoke con `curl` recorre alta, tema,
listados, CSV y marcado.

Pendiente estructural: separar `signups` y `topic_requests` en actions con sus propios README;
la presentación se encuentra actualmente en archivos compartidos.
