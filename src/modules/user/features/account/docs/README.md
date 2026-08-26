# `features/account` — el porqué

Las dos acciones que no son "editar un campo del perfil": el pie de la pantalla y el botón rojo
del final. Se montan bajo `/me` desde `index.ts:8-9`.

| Método | Ruta | Action | Respuesta |
| --- | --- | --- | --- |
| `GET` | `/me/summary` | `get_summary` | `200 { member_since, completed_courses }` |
| `DELETE` | `/me` | `delete` | `204` |

## 1. Por qué no están en `features/profile`

`profile` es el formulario: cinco campos, una contraseña y una foto, todo lo que se **edita**.
Estas dos hablan de la cuenta como un todo —cuánto llevas aquí, y dejar de estar—, y `delete` es
la única action del módulo que toca tablas de otros tres módulos. Separarlas mantiene el service
de perfil sin ramas y deja la baja donde se puede leer entera.

## 2. El orden de montaje importa un poco

`index.ts:8-9` monta primero `get_summary` y después `delete`. No hay solapamiento —`/summary`
contra `/` con métodos distintos—, pero el orden fija que la ruta más específica se declare antes,
que es la costumbre del repo y lo que evita sorpresas el día que aparezca `/me/algo-mas`.
