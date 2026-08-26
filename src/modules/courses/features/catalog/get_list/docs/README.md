# `GET /courses` — el porqué

Catálogo público de la pantalla 01 del brief: la lista de cursos publicados, sus filtros y **los
contadores que van al lado de cada filtro**. Es la primera pantalla que ve alguien que no tiene
cuenta, así que no lleva autenticación de ningún tipo — ni siquiera opcional.

## 1. El recorrido

```text
GET /api/v1/courses?topic=…&level=…&search=…
  → getListController              parse → service → sobre
  → getListSchema.parse(req.query) query → listas de enum + término de búsqueda
  → getListService                 4 consultas en paralelo, filtro de texto y facetas
  → courses.repository             shared/data: cuatro consultas con select explícito
  → toApiCatalogCourse             el modelo público, campo a campo
  → 200 { … data: { courses, facets } }
```

| Paso | Archivo |
| --- | --- |
| cadena de la ruta | `presentation/get_list.routes.ts:8` |
| validación → service → respuesta | `presentation/get_list.controller.ts:9-21` |
| orquestación | `presentation/get_list.service.ts:15-35` |
| facetas | `domain/catalog_facets.ts:29-46` |
| búsqueda | `domain/course_search.ts:4-23` |
| persistencia | `src/modules/courses/shared/data/courses.repository.ts:108-157` |

## 2. La regla de las facetas: no se calculan sobre el resultado filtrado

Es la decisión central de este slice y el error clásico de los catálogos con facetas.

La pantalla 01 pinta los contadores **al lado de cada filtro**, no debajo de la lista. Si el
visitante filtra por "IA aplicada", el contador de "Legal engineering" tiene que seguir diciendo
`2`: es lo que le dice cuántos cursos encontrará **si cambia de filtro**. Calculado sobre el
resultado filtrado diría `0`, y la interfaz se convertiría en un callejón sin salida donde el
único filtro con cursos es el que ya está puesto.

La regla, entonces: **cada faceta se calcula aplicando los *demás* filtros, no el propio.**

| Faceta | Qué filtro aplica | Qué filtro NO aplica | Dónde |
| --- | --- | --- | --- |
| `facets.topic.*` | `level` | `topic` | `presentation/get_list.service.ts:21` |
| `facets.level.*` | `topic` | `level` | `presentation/get_list.service.ts:22` |
| `facets.topic.ALL` | `level` | `topic` | suma de los contadores por tema, `domain/catalog_facets.ts:38` |

`ALL` es el *"Todos 6"* de la pantalla: el total del catálogo con el filtro de nivel puesto. No es
el número de temas, y por eso se calcula sumando los contadores en vez de contando claves
(`domain/catalog_facets.ts:36-39`).

**La búsqueda no toca las facetas.** Es deliberado y sale del brief: la pantalla E2
("búsqueda sin resultados") enseña la lista vacía **con los filtros intactos al lado**, para que
el visitante pueda salir de ahí en un clic. Si la búsqueda pusiera todas las facetas a cero, E2
sería una pantalla sin salida. Por eso la búsqueda vive en el service
(`presentation/get_list.service.ts:30`) y no viaja a las consultas de facetas.

Las facetas **siempre traen las cinco claves de tema y las dos de nivel**, aunque valgan cero
(`domain/catalog_facets.ts:16-27`). El frontend pinta la lista completa de filtros; una clave
ausente le obligaría a inventar el cero. Los objetos vacíos se escriben campo a campo en vez de
generarse con `Object.values`, porque así **añadir un tema al enum rompe el typecheck aquí**, que
es exactamente donde queremos enterarnos.

## 3. Por qué el filtro de texto no está en SQL

La fase 09 da dos opciones para buscar sin acentos: `unaccent` en PostgreSQL o normalizar en el
service. Se eligió la segunda, y el reparto queda así:

- **SQL filtra lo que sabe comparar exactamente**: `status`, `topic` y `level` son enums, y van en
  el `where` (`src/modules/courses/shared/data/courses.repository.ts:94-106`).
- **El service filtra lo que exige normalizar**: título y descripción corta, con acentos
  descompuestos y descartados (`utils/normalize_search.ts:4-5`).

`unaccent` es una extensión de PostgreSQL: exige una migración con `CREATE EXTENSION`, obliga a
bajar la consulta a SQL crudo —perdiendo el `select` tipado que es la garantía de esta fase— y
además no es indexable sin un índice funcional. Todo eso para seis filas. La normalización en
memoria hace lo mismo, es simétrica (`práctica` encuentra `practica` **y** al revés) y se prueba
sin base de datos.

**Dónde está el punto de corte.** Este reparto es correcto mientras el catálogo quepa en una
respuesta. El día que haya paginación —cientos de cursos—, filtrar en memoria empieza a mentir:
la página 1 se recortaría después de haberse llenado. Ahí es donde entra `unaccent` con su índice,
y el único archivo que cambia es el repositorio.

## 4. Los totales se agregan en la consulta

`lesson_count` y `total_duration_seconds` **no son columnas**. La fase 08 no las denormalizó a
propósito: *"una columna desnormalizada es una columna que algún día miente"*. Salen de un
`groupBy` sobre `lessons` (`src/modules/courses/shared/data/courses.repository.ts:117-133`) con
`_count` y `_sum` — la agregación la hace PostgreSQL, no Node.

`total_duration_seconds` suma **las dos formas de duración**: los segundos de los videos y los
minutos de lectura de los artículos convertidos a segundos
(`src/modules/courses/shared/domain/course_totals.ts:12-13`). La tarjeta del brief anuncia
*"6 lecciones · 1 h 10 min"* para un curso con cuatro videos y dos artículos: si solo se sumaran
los videos, dos de esas seis lecciones no contarían para el tiempo que la tarjeta promete.

El `groupBy` y la lista de cursos se piden **en paralelo** y se cruzan por `course_id` con un
`Map` (`presentation/get_list.service.ts:25-27`). Un curso sin lecciones publicadas no aparece en
el `groupBy`; `toCourseTotals(undefined)` devuelve ceros
(`src/modules/courses/shared/domain/course_totals.ts:15-24`) en vez de reventar. Es el caso E4 del
brief visto desde el catálogo.

## 5. La entrada: enums, varios valores y una búsqueda

`topic` y `level` aceptan **varios valores**, en las dos formas que el frontend puede generar:
repetidos (`?topic=A&topic=B`) y separados por coma (`?topic=A,B`). Las dos se aplanan en la misma
lista antes de validar (`domain/get_list.schema.ts:15-25`), y **el valor se valida contra el enum
de Prisma**: un tema inventado es `422 VALIDATION_ERROR` con la clave i18n
`courses.errors.topic_invalid`, no un filtro silenciosamente ignorado.

`search` toma el primer valor si llega repetido, se recorta y **se convierte en `undefined` si
queda vacío** (`domain/get_list.schema.ts:39-43`): `?search=` es "sin búsqueda", no "busca la
cadena vacía". El tope de 120 caracteres (`src/constants/courses.ts:31`) evita que la
normalización trabaje sobre un texto arbitrariamente largo.

## 6. La respuesta

`200` siempre que la query sea válida, incluso sin resultados. **E1 (catálogo vacío) y E2
(búsqueda sin resultados) no son errores**: son pantallas con su acción al lado, y un `404` las
convertiría en un fallo. La lista viene ordenada por `catalog_order`
(`src/modules/courses/shared/data/courses.repository.ts:114`), que es el orden editorial que fija
la fase 14, no por fecha ni por título.

El curso sale por `toApiCatalogCourse`
(`src/modules/courses/shared/domain/course_mapper.ts:12-24`), la única puerta pública del modelo.
El `id` interno **se pide** al `select` —hace falta para cruzar el agregado— y **no se expone**:
el mapper no lo copia. Esa es la razón de que exista el mapper y no se devuelva la fila.

## 7. Los tests

- `test/get_list.service.test.ts` — la regla de las facetas con un tema filtrado, `ALL` como suma,
  la búsqueda sin resultados con las facetas intactas, y `IA aplicada` / `ia aplicada` /
  `práctica` / `practica` devolviendo lo mismo.
- `test/catalog_facets.test.ts` — el relleno con ceros y que `ALL` no es el número de temas.
- `test/normalize_search.test.ts` — acentos, mayúsculas y espacios.
- `test/get_list.controller.test.ts` — el router real con Supertest: el sobre, los dos formatos de
  valores múltiples, el `422` con su clave i18n y que un fallo del service sale por el manejador
  global (no hay `try/catch`).
