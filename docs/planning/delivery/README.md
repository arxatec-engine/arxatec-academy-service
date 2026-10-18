# Entrega y verificación del backend

**Estado:** el producto tiene módulos implementados en el árbol de trabajo; este documento
ordena su verificación y pendientes. No reconstruye una entrega histórica ni certifica
producción. [Índice](../README.md) · [Pruebas](../../TESTING.md).

## Dependencias y bloques verificables

| Bloque              | Código existente                                        | Resultado que se debe demostrar                             |
| ------------------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| Base                | Configuración, errores, Prisma, migraciones y lifecycle | Arranque correcto y cierre sin recursos vivos               |
| Identidad           | Registro, sesiones, correo, reset y Google              | Usuario público, revocación y canje seguro                  |
| Contenido público   | Catálogo, facetas, ficha y lección                      | Solo publicación, acceso muestra/sesión y navegación        |
| Aprendizaje         | Inscripción, avance, marcado y Mis cursos               | Unicidad, máximo concurrente y cambio de temario            |
| Comunidad/cuenta    | Hilos, reportes, perfil, contraseña y baja              | Verificación al escribir, aislamiento y limpieza persistida |
| Editor              | Cursos, lecciones, recursos y video                     | Autorización, conflictos y transiciones reales              |
| Operación editorial | Moderación, directorio/CSV, avisos y temas              | Revisión, filtros, fórmulas de CSV y marcado sin envío      |

Esos bloques describen dependencias funcionales, no una secuencia de fases P0–P4 heredada de
Admin. El checklist de cada área enlaza a sus tests y código.

## Entornos y fixtures

Las integraciones requieren `DATABASE_URL` explícita de una base desechable y migraciones.
`TEST_DATABASE_URL` no se consume. El seed prepara el catálogo esperado, pero reescribe sus
fixtures; comentarios y progreso también modifican ese contenido durante pruebas.
No usar la base de desarrollo con datos de revisión compartidos, ni producción.

| Fixture                                                  | Comprobación                                                |
| -------------------------------------------------------- | ----------------------------------------------------------- |
| STUDENT sin verificar y ADMIN persistido                 | Acceso por sesión/rol y verificación solo donde corresponde |
| Email existente, desconocido y Google sin hash           | Respuestas definidas, sin filtración accidental de hash     |
| Curso DRAFT/PUBLISHED/ARCHIVED                           | Visibilidad y transiciones                                  |
| Muestra, artículo y video de ambos proveedores           | Acceso, saneado, duración y contenido incompatible          |
| Posiciones fuera de orden y escrituras simultáneas       | Máximo de avance y restricciones únicas                     |
| Curso cerrado al que se añade contenido                  | Estado actual separado de fecha persistida                  |
| Raíz, respuesta, autor borrado/rol cambiado y reportes   | Proyección pública y contadores de moderación               |
| Usuarios en límite de día Lima y CSV con fórmula         | Filtros, fechas y neutralización de celdas                  |
| Aviso general/curso y solicitudes normalizadas repetidas | Índice parcial, unicidad y métricas de demanda              |
| Recurso compartido por duplicado                         | No borrar bytes aún referenciados                           |

## Comprobaciones de una entrega funcional

Aplicar [TESTING](../../TESTING.md): lint, tipos de aplicación/tests, fronteras, citas,
unitarios, PostgreSQL aislado, build y formato. El build requiere Prisma generado previamente.
Para smoke, usar servidor compilado y la base desechable con permiso explícito del script.
Registrar comandos realmente ejecutados; no poner «passed» por inspeccionar un archivo de test.

La verificación operativa añade SMTP, Google y video reales, URLs desde el origen final,
persistencia de archivos y cierre por señal. Los dobles de red permiten probar reglas,
pero no certifican las integraciones externas.

## Trabajo pendiente con criterio de cierre

| Pendiente                              | Criterio concreto                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| Separar acciones administrativas       | Mismas rutas y DTOs, README/test por acción y fronteras aprobadas                     |
| Consolidar tokens compartidos          | Consumo único y transacciones preservados; mocks por especificador actualizados       |
| Implementar S3                         | Puerto completo, permisos reales, limpieza compartida y migración de URLs probados    |
| Decidir recursos privados              | Contrato de autorización de bytes y comportamiento CDN/cache definido e implementado  |
| Acotar consultas crecientes            | Búsqueda y paginación coherentes, exportaciones medidas y límites acordados           |
| Aislamiento de integración por defecto | Runner que consuma conexión de test separada con guardas, sin escribir en la habitual |
| Definir ADMIN inicial de producción    | Procedimiento autorizado que no abra elevación pública ni use seed demo               |
| Retorno OAuth fallido                  | Contrato frontend/backend y escenarios de cancelación/proveedor probados              |
| Preparar producción                    | Evidencia de checks, migraciones objetivo, configuración y smoke controlado           |

Es una lista de trabajo futuro, no instrucciones para ejecutar cambios funcionales durante
esta actualización de documentación. Las prioridades dependen de la release y de datos reales.

## Recursos y cierre documental

Medir latencia, RSS y conexiones del proceso compilado con catálogo/directorio representativos,
subidas y login concurrentes. Academy no hereda el presupuesto de pool/Argon2 de Admin.
Antes de añadir infraestructura, revisar consultas, índices, buffers y semántica del contrato.

Cerrar cada cambio actualizando el README de su unidad, API, entorno si aplica y decisiones.
Registrar intención, cambios, evidencia y pendientes en [shipped](../../shipped/README.md).
La entrega de documentación se identifica como tal y no mueve a «terminado» las tareas de
producto que solo quedaron descritas.
