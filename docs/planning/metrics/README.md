# Definiciones de métricas y cobertura

**Estado:** definiciones derivadas de los mappers y consultas actuales. [Índice](../README.md) ·
[Contratos](../http_contracts/README.md). No existe un módulo general de analítica de Academy.

## Qué cuenta cada cifra

| Métrica                                | Definición actual                                                                 | Límites de interpretación                              |
| -------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| lesson_count público                   | Lecciones PUBLISHED del curso                                                     | No incluye borradores                                  |
| total_duration_seconds                 | SUM de segundos de VIDEO y minutos de ARTICLE × 60 publicados                     | Estimación de contenido, no tiempo estudiado           |
| video_count/article_count              | Cantidad publicada por tipo en ficha                                              | No representa reproducciones/lecturas                  |
| Faceta topic                           | Cursos publicados aplicando nivel, sin tema ni search                             | No coincide necesariamente con longitud de la búsqueda |
| Faceta level                           | Cursos publicados aplicando tema, sin nivel ni search                             | Contador de alternativas de filtro                     |
| Faceta topic.ALL                       | Suma de temas con filtro de nivel                                                 | No es número de temas ni total tras search             |
| counts de cursos admin                 | Total y estados de todas las filas de courses                                     | No se limita al catálogo público                       |
| completed_lessons                      | Intersección de lecciones publicadas con progreso completado del usuario          | Despublicar cambia el denominador y el conteo visible  |
| Curso al día                           | Al menos una lección publicada y todas completadas                                | Añadir una lección puede retirar esta condición        |
| Mis cursos completed                   | Inscripción con completed_at y curso al día, actualmente publicado                | No equivale a cualquier cierre histórico               |
| completed_courses en perfil/directorio | Inscripciones con completed_at no nulo                                            | No recalcula temario ni filtra curso archivado         |
| total_registered                       | COUNT de usuarios retenidos                                                       | Incluye roles; no cuenta cuentas ya borradas           |
| registered_this_week                   | Usuarios creados desde lunes de reporte                                           | Global, no se limita a filtros del directorio          |
| reported de moderación                 | Comentarios VISIBLE con reporte no revisado                                       | Cuenta comentarios, no suma reportes                   |
| pending de moderación                  | Unión de reported y raíces visibles de autor no ADMIN sin respuesta visible ADMIN | Incluye reported; no sumar ambos contadores            |
| request_count por tema                 | Suma de veces solicitado para término normalizado                                 | Un mismo correo puede contribuir varias veces          |
| distinct_emails por tema               | Correos diferentes de las filas agrupadas                                         | No son necesariamente cuentas verificadas              |
| marked de avisos                       | Filas antes del corte que pasan de no avisadas a marcadas                         | No mide entrega de correo                              |
| has_account de aviso                   | Email coincide con usuario actual                                                 | No prueba sesión/identidad al suscribirse              |

## Fechas, estados y cambios del contenido

Fechas de API se serializan ISO UTC. Reportes usan REPORTING_UTC_OFFSET_MINUTES, -300 por
defecto. registered_from empieza al inicio del día de reporte y registered_to incluye el día
completo mediante una cota exclusiva del siguiente. La semana empieza lunes, no últimos siete
días móviles. El offset es fijo; no representa una zona con reglas de horario de verano.

`published_at` de curso es la primera publicación y bloquea slug; no se renueva al publicar de
nuevo. `enrollments.completed_at` conserva el cierre al añadir contenido, pero se limpia si el
usuario desmarca explícitamente una lección. No es un historial inmutable de certificaciones.

`last_position_seconds` guarda el máximo declarado y no prueba segundos efectivos consumidos.
created_at de cuenta no representa primera visita y last_used_at de sesión puede actualizarse
con retraso de cinco minutos o no renovarse en rutas de auth opcional. No describirlo como
presencia en línea.

## Ejemplos que evitan interpretaciones erróneas

Un alumno completó cuatro lecciones y su inscripción tiene fecha de cierre. Al publicar una
quinta, Mis cursos lo mueve a in_progress con 4/5; el resumen y directorio aún pueden contar
un curso cerrado. Completar la quinta recupera el estado actual manteniendo la fecha anterior.
Desmarcar una lección, en cambio, limpia esa fecha.

Un comentario puede tener tres reportes abiertos: reported suma uno. Si además no tiene
respuesta del equipo, pending sigue sumando uno, no dos. La condición de equipo usa rol actual:
revocar ADMIN puede cambiar is_answered sin borrar la respuesta.

Tres solicitudes de «IA aplicada» del mismo correo suman request_count=3 y distinct_emails=1.
Marcar un aviso con fecha de corte incrementa marked aunque ningún correo haya salido del
servidor. Esos nombres deben conservar su significado en la interfaz.

## Precisión y consistencia

Los conteos y bytes admitidos usan números enteros JSON; el tamaño máximo de un archivo está
acotado a 20 MiB. No hay dinero, créditos, BigInt de cuota ni conversión multimoneda en estas
respuestas. Artículos calculan minutos con Math.round(words/200), mínimo uno para no vacío.

Los datos opcionales siguen nullable; no sustituir una fecha desconocida por ahora. Listado,
conteo y estadísticas pueden ejecutarse en consultas distintas sin snapshot global; no prometer
que una pantalla completa representa una única transacción. El `timestamp` del sobre es el
momento de construir la respuesta, no una marca asOf de todos los registros.

## Información aún no disponible

No hay cobertura para DAU/WAU/MAU, retención, embudos, reproducción por intervalos, duración
efectiva de estudio, certificados, calificaciones o presencia. Tampoco CPU/RAM/uptime salen
de estas tablas. El estado de cuenta, la sesión válida o una posición guardada no permiten
inventar esas métricas. Se requieren eventos, definiciones y retención antes de dibujarlas.

## Verificación

Fixtures deben incluir curso sin publicadas, nueva lección tras cerrar, archivado con progreso,
desmarcado, autor con rol cambiado, reportes repetidos y fechas alrededor de medianoche Lima.
Comparar con resultados conocidos pequeños, sin descargar bases reales para verificarlos.
Los tests existentes y su preparación están en [TESTING](../../TESTING.md).
