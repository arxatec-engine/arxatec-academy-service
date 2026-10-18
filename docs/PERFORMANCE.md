# Rendimiento y memoria

Academy ejecuta Express en un proceso y comparte un cliente Prisma con adaptador `pg`. No inicia
workers, cachés distribuidas ni polling. Esta guía describe límites visibles en el código;
no hay un benchmark de Academy que permita prometer latencia, RSS o capacidad concurrente.

## Presupuesto real de recursos

| Recurso            | Implementación                                   | Implicación                                                                                   |
| ------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| PostgreSQL         | Un `PrismaPg` con `connectionString`             | No hay `max`, timeout de consulta ni cola de admisión configurados por la aplicación          |
| Contraseñas        | Argon2id con opciones por defecto de la librería | No hay una cola acotada propia ni un límite global de trabajo criptográfico                   |
| Sesión obligatoria | Consulta de sesión/usuario por petición          | Permite revocación y rol actual; renovación escribe como máximo cada cinco minutos por sesión |
| Rate limit         | Memoria del proceso                              | Reiniciar borra ventanas; varias réplicas tienen contadores independientes                    |
| JSON/formulario    | Límite de 1 MiB para cada parser                 | Multipart se limita aparte por uso                                                            |
| Subidas            | Multer en memoria, un archivo                    | El buffer cuenta en RSS; un recurso puede ocupar hasta 20 MiB por petición                    |
| Probe de video     | Fetch con timeout de 3000 ms por defecto         | No hay caché ni semáforo global de probes                                                     |

El presupuesto de dos conexiones, la cola Argon2 y las mediciones de Admin no describen Academy.
Consultar [configuración Prisma](../src/config/prisma_client.ts),
[hash de contraseñas](../src/infrastructure/password/hash_password.ts) y
[multipart](../src/middlewares/file_upload.ts) antes de cambiar sus límites.

## Consultas y crecimiento

Catálogo agrupa totales en PostgreSQL y obtiene facetas sin cargar el contenido de artículos.
Sin embargo, devuelve todos los cursos coincidentes y aplica la búsqueda normalizada en Node.
El listado administrativo de cursos también carece de paginación. Ambas decisiones sirven al
catálogo actual y deben revisarse antes de introducir miles de cursos.

«Mis cursos» obtiene lecciones de varios cursos en una consulta y cruza los resultados por id.
El progreso usa inserción con conflicto ignorado y actualización condicional, evitando una
lectura previa para decidir el máximo. Las transacciones de marcado se mantienen cortas.

Moderación limita páginas a 50; directorio y avisos a 100. La búsqueda del directorio lee
candidatos de todos los usuarios y normaliza nombre/correo/organización en memoria, tanto para
conteo como para página/exportación. No se debe afirmar que esa búsqueda sea indexada ni que
todo el trabajo esté limitado por `per_page`.

El CSV de usuarios cuenta primero y rechaza más de `ADMIN_EXPORT_MAX_ROWS` (50000 por defecto),
pero después materializa filas y buffer completos. El CSV de avisos y la agrupación de temas
leen todo el conjunto seleccionado y no tienen ese tope. El hilo público de comentarios tampoco
está paginado. Son los primeros puntos a medir si crece la comunidad.

## Medición antes de aumentar capacidad

Medir `node dist/server.js` por separado de `tsx watch`, compilación y Jest. Registrar versión
de Node, configuración no sensible, tamaño de fixtures, concurrencia, p50/p95/p99, errores,
RSS/heap y conexiones activas. No copiar cifras de otro producto ni presentar una llamada
secuencial local como prueba de carga.

Los escenarios relevantes son login simultáneo, catálogo con búsqueda, directorio con CSV,
subidas de recursos cercanas al límite y avance concurrente de muchos alumnos. Usar una base
desechable y archivos propios. Revisar planes `EXPLAIN`, índices y proyecciones antes de ampliar
el pool o añadir infraestructura.

Separar el tiempo del proveedor de video/SMTP del tiempo de PostgreSQL. El cierre ordenado debe
liberar HTTP, Prisma y transporte de correo sin procesos pendientes. Si se usan varias
instancias, acordar almacenamiento compartido y rate limit antes de repartir tráfico.

## Aceptación de una optimización

Conservar los [contratos y métricas](planning/metrics/README.md): no recortar la página después
de buscar, alterar facetas, perder el máximo del progreso ni exponer columnas para ahorrar un
mapper. Anotar carga inicial, cambio y medida posterior en la entrega. La validación funcional
está en [TESTING](TESTING.md).
