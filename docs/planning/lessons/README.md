# Lecciones: acceso, edición, video y recursos

**Estado:** implementado. [Lectura](../../../src/modules/courses/features/lessons/docs/README.md) ·
[Editor](../../../src/modules/courses/features/admin_lessons/docs/README.md) · [Índice](../README.md).

## Lectura pública y del alumno

`GET /api/v1/courses/:course_slug/lessons/:lesson_slug` usa autenticación opcional. Solo lee
curso y lección publicados. Si cualquiera no está publicado o no existe, devuelve 404.
Una muestra gratuita se abre sin sesión; cualquier publicada se abre con sesión activa, sin
exigir correo verificado ni inscripción.

| Resultado         | Datos                                                        |
| ----------------- | ------------------------------------------------------------ |
| 200 abierto       | lesson, course y navigation                                  |
| 403 LESSON_LOCKED | Metadatos de lesson, referencia course y lessons del temario |

La forma bloqueada no incluye article_body, video, transcript ni resources. El service no pide
la selección abierta si no hay acceso. La navegación anterior/siguiente usa la lista publicada,
salta borradores y contiene solo slug/título. `null` indica un borde real.

La forma abierta incluye id, slug, título, descripción, tipo, posición, muestra, duración,
video nullable `{ provider, external_id }`, artículo nullable, minutos de lectura,
transcripción, recursos y `updated_at`. Un recurso público entrega título, URL, MIME y bytes.
El servidor referencia el video, no retransmite sus bytes.

## Temario y editor

ADMIN obtiene/crea lecciones en `/admin/courses/:course_id/lessons`, reordena en su `/order` y
lee/edita/borra en `/admin/lessons/:id`. Crear requiere title (1–160) y type ARTICLE/VIDEO;
genera slug único dentro del curso y una posición. GET de editor devuelve lesson y course.

PATCH admite title, slug (hasta 160), description, type, is_free_sample, video_provider,
video_external_id, duration_seconds, article_body, transcript y confirm_type_change. No tiene
`expected_updated_at`: no atribuirle el control optimista del curso. Los ids se validan como
strings no vacíos.

Marcar `is_free_sample: true` mueve la muestra dentro del curso desmarcando las demás.
Reordenar exige `lesson_ids` completos y sin inconsistencias; recursos usan `resource_ids`.
Los índices únicos por posición requieren escrituras coordinadas, no cambios sueltos desde UI.

## Artículos y cambio de tipo

Cambiar tipo con contenido previo exige `confirm_type_change: true`; sin ello devuelve
409 LESSON_TYPE_CHANGE_NOT_CONFIRMED y `data: { from, to, will_discard }`. La escritura elimina
columnas del tipo anterior y descarta campos rezagados del editor del otro tipo.

El HTML permite p, h2, h3, strong, em, listas, enlaces y br. Descarta elementos activos y solo
admite enlaces http/https/mailto. El saneado limita a 150000 caracteres resultantes. Calcula
palabras quitando etiquetas y `reading_minutes = max(1, round(words / 200))` para texto no vacío;
vacío produce cero. No es un cálculo de minutos por redondeo hacia arriba.

Una edición que deja incompleto el contenido publicado lo devuelve a DRAFT. Publicar exige
título, slug, descripción y contenido válido; artículo vacío devuelve ARTICLE_BODY_EMPTY y
otros faltantes LESSON_INCOMPLETE con `data.missing_fields`. POST publica; DELETE sobre
`/admin/lessons/:id/publish` despublica, sin borrar contenido.

## Proveedores de video

`POST /admin/videos/probe` acepta `{ provider, external_id }`. VIMEO exige dígitos y YOUTUBE un
id de 11 caracteres `[A-Za-z0-9_-]`. No recibe una URL arbitraria del cliente: el adaptador
construye la URL oEmbed del proveedor. Respuesta: duration_seconds nullable, title y thumbnail_url.

Vimeo toma duración del proveedor, ignorando el dato manual. YouTube no la devuelve y exige
segundos positivos enviados por el editor (hasta 2147483647). Si se añade id sin proveedor a
una nueva lección, se toma YOUTUBE. Cambiar proveedor/id provoca probe; cambiar solo título no.

Proveedor no disponible en un PATCH puede conservar el guardado como borrador con 200 y
`meta.code=VIDEO_PROVIDER_UNAVAILABLE`. El probe directo devuelve 502 en indisponibilidad;
video no encontrado o no insertable devuelve 422. El timeout por defecto es 3000 ms. El modo
fake evita red y no valida accesibilidad; los placeholders históricos no son videos reales.

## Recursos y borrado

POST de recurso recibe multipart file/title y devuelve 201 con resource; PATCH solo cambia
título y DELETE devuelve 204. Archivos de hasta 20 MiB y tipos admitidos están en
[STORAGE](../../STORAGE.md). Borrar un recurso retira el objeto solo sin otras referencias.

Borrar una lección publicada devuelve 409 LESSON_PUBLISHED. En borrador, progreso/comentarios
exigen `confirm_destroys_student_data: true`; el conflicto devuelve sus conteos. Tras confirmar,
el borrado es físico, ajusta posiciones y limpia archivos no compartidos. El éxito es 204.

## Verificación y pendientes

Unitarios cubren acceso, mappers, navegación, políticas y saneado. La
[integración editorial](../../../tests/integration/postgres/admin_lessons_flow.test.ts) cubre
persistencia y estados. Aceptación adicional operativa: reproducción de videos reales en el
dominio final, archivos descargables y contenido legible. El probe por sí solo no garantiza
reproducción. Separar las acciones agrupadas y un eventual control de ediciones concurrentes
requiere una entrega propia con frontend y pruebas.
