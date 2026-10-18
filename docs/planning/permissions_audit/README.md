# Identidad, permisos, campos y trazabilidad

**Estado:** sesiones y rol ADMIN implementados; sin capacidades ni auditoría general de
comandos. [Auth](../auth/README.md) · [Índice](../README.md).
No trasladar el modelo de permisos persistidos de Admin a Academy sin una implementación propia.

## Matriz de acceso

| Superficie                     | Anónimo           | Sesión STUDENT           | ADMIN                      |
| ------------------------------ | ----------------- | ------------------------ | -------------------------- |
| Catálogo, ficha e hilo visible | Sí                | Sí                       | Sí                         |
| Lección muestra publicada      | Sí                | Sí                       | Sí                         |
| Otra lección publicada         | 403 con metadatos | Sí                       | Sí                         |
| Inscripción y progreso         | 401               | Sí                       | Sí, sobre su propia cuenta |
| Perfil, resumen y baja         | 401               | Sí, identidad propia     | Sí, identidad propia       |
| Comentario/respuesta pública   | 401               | Sí con correo verificado | Sí con correo verificado   |
| Reporte de comentario          | 401               | Sí                       | Sí                         |
| Alta aviso/tema                | Sí con email      | Usa email de sesión      | Usa email de sesión        |
| Rutas `/admin`                 | 401               | 403 FORBIDDEN            | Sí                         |
| Archivos bajo `/files`         | Sí con URL        | Sí                       | Sí                         |

Lecturas opcionales tratan token inválido como anónimo. Todas las rutas administrativas
montan authenticateTokenJwt y requireAdmin antes del controller. Responder desde moderación
no añade el middleware de correo verificado de los hilos públicos.

El rol se lee desde PostgreSQL junto con la sesión. Cambiarlo no exige esperar al vencimiento
del JWT para aplicar permisos. Registro no acepta elevar rol y no hay una API pública de
asignación ADMIN. El seed de desarrollo no define un bootstrap productivo.

## Campos permitidos y excluidos

| Proyección        | Incluye                                         | Excluye                                         |
| ----------------- | ----------------------------------------------- | ----------------------------------------------- |
| Usuario propio    | Perfil, correo, rol, proveedor y verificación   | Hash, tokens OAuth, sesiones y clave de archivo |
| Autor público     | Nombre, avatar, afiliación e insignia de equipo | Email, user_id y credenciales                   |
| Lección bloqueada | Identidad, tipo, duración y temario público     | Video, artículo, transcripción y recursos       |
| Editor            | Borradores y metadatos necesarios de contenido  | Credenciales de proveedores/almacenamiento      |
| Directorio        | Perfil y conteos permitidos para ADMIN          | Hash, tokens, IP y user agent                   |
| Avisos admin      | Direcciones y fechas de altas                   | ip_hash y secretos de la sal                    |

Los repositorios seleccionan campos y los mappers construyen DTOs. Que Prisma permita acceder
a una columna no autoriza enviarla al navegador. Para una descarga local, la barrera es
conocer su URL pública: ocultar resources en un DTO no autentica el acceso a sus bytes.

## Sesiones, red y logs

Bearer se envía en Authorization, no en query. State Google usa nonce de cookie y código de
canje temporal; HTTP logger omite query y cabeceras de respuesta. Request id permite correlación.
Evitar registrar cuerpos, Authorization o enlaces con tokens al añadir instrumentación.

El correo log solo se admite en pruebas e incluye el cuerpo para verificar flujos. Esos
logs son sensibles. Auth guarda IP y user agent de sesión; avisos/temas guardan IP hasheada
con sal. No afirmar que toda IP del producto esté anonimizada por esa variable.

CORS permite el origen de FRONTEND_URL y solicitudes sin Origin. El backend verifica sesión
y rol por separado; CORS no protege contra clientes HTTP directos. No existe una protección de
mutaciones por Origin idéntica a la cookie estricta de Admin.

## Trazabilidad que existe

Moderación conserva hidden_at/hidden_by_user_id, deleted_at/deleted_by_user_id y revisión de
reportes con fecha/revisor. Esas escrituras usan transacciones con los cambios de estado.
Los logs incluyen actor y acción; exportar directorio registra actor, request id, conteo y
presencia de búsqueda sin guardar el texto buscado.

Curso usa fecha esperada para no sobrescribir autoguardado. Es control de concurrencia, no
auditoría de versiones. Lecciones y otros comandos no tienen ese token. No hay tabla general
de cambios, historial completo before/after, commandKey ni recibos transaccionales.

## Comandos futuros y aceptación

Si se añaden roles granulares, cambio de rol, suspensión o envío masivo, definir permiso por
acción, razón, estado esperado, repetición y campos auditables. El actor seguirá saliendo de
la sesión y la escritura y auditoría deberán compartir la unidad transaccional pertinente.
No habilitar una elevación mediante un campo del formulario de registro.

La [matriz de integración](../../../tests/integration/postgres/admin_access_control.test.ts)
recorre rutas sin sesión y con STUDENT. La aceptación también exige ausencia de secretos en
JSON, verificación en las dos escrituras públicas del hilo, limpieza real de cuenta y bloqueo
de contenido no publicado. Las pruebas no reemplazan la comprobación de configuración y
dominio final de [producción](../../PRODUCTION_READINESS.md).
