# `GET /me/summary` — el porqué

El pie de la pantalla 11: *"Miembro desde mayo de 2026 · 1 curso terminado"*.

## 1. El recorrido

```text
GET /api/v1/me/summary
  → authenticateTokenJwt   sin sesión → 401 UNAUTHENTICATED
  → getSummaryController   usuario → parse → service → 200
  → getSummaryService      created_at + count de inscripciones terminadas
  → 200 { member_since, completed_courses }
```

| Paso | Archivo |
| --- | --- |
| cadena de la ruta | `presentation/get_summary.routes.ts:9` |
| usuario → validación → service → respuesta | `presentation/get_summary.controller.ts:11-23` |
| reglas | `presentation/get_summary.service.ts:7-17` |
| fecha de alta | `../../../shared/data/user_account.repository.ts:50-51` |
| cursos terminados | `src/modules/progress/shared/data/progress.repository.ts:194-195` |

## 2. Va aparte de `GET /auth/me`, y ése es todo el diseño

`GET /auth/me` corre en **cada carga de la app**: es la llamada que decide si hay sesión. Meterle
un `count` sobre `enrollments` sería pagar una agregación en todas las pantallas para pintarla en
**una**, la del perfil, que es la que menos se abre.

Al revés tampoco: este endpoint **no** devuelve el usuario. Quien abre el perfil ya lo tiene en
memoria desde el arranque; repetirlo aquí sería una segunda copia de la misma forma que mantener.
Por eso la respuesta son dos campos y nada más.

## 3. `completed_courses` se cuenta, no se guarda

`countCompletedEnrollments` (`progress.repository.ts:194-195`) cuenta las inscripciones con
`completed_at` no nulo. Es la fachada de `modules/progress`, ampliada en esta fase: **este módulo
no lee `enrollments` por su cuenta**, porque el `data/` de otro módulo no se importa nunca
(`02_reglas_backend.md` §9.6).

La fecha la sella la fase 11 cuando cae la última lección
(`modules/progress/shared/data/progress.repository.ts:153-156`), y **no se recalcula aquí**. La
consecuencia está asumida desde entonces: si a un curso terminado se le añade una lección nueva,
"Mis cursos" lo devuelve a *en progreso* pero su `completed_at` no se borra, así que este contador
lo sigue contando. Es lo correcto para un pie que dice *"1 curso terminado"* — el alumno lo
terminó de verdad, y el catálogo creció después.

## 4. Dos consultas, no una

Podrían ser un `include` con `_count`. Son dos porque el `select` de `users` de este módulo es
deliberadamente estrecho —`created_at` y nada más (`USER_SUMMARY_SELECT`)— y porque la segunda
tiene que ir por la fachada del otro módulo. Dos consultas por índice en la pantalla menos
visitada es un coste que se ve venir; una consulta con `join` a través de la frontera de un módulo
es una regla rota.

## 5. Los tests

- `test/get_summary.service.test.ts` — la fecha en ISO, el conteo delegado en la fachada, el cero
  de una cuenta sin cursos y el `404` que no llega a contar.
- `test/get_summary.controller.test.ts` — el `200` con los dos campos, el `user_id` de la sesión y
  el `401` sin Bearer.
- `tests/integration/postgres/account_flow.test.ts` caso 15 — de `0` a `1` insertando una
  inscripción terminada de verdad, y `member_since` comparado con el `created_at` de la fila.
