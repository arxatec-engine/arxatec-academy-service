# `PATCH /me/profile` — el porqué

El botón *Guardar cambios* de la pantalla 11.

## 1. El recorrido

```text
PATCH /api/v1/me/profile
  → authenticateTokenJwt      sin sesión → 401 UNAUTHENTICATED
  → updateProfileController   usuario → parse → service → 200
  → updateProfileSchema       los mismos campos y reglas que el registro
  → updateProfileService      resolveAccountFields → UPDATE de cinco columnas
  → 200 { user }              el mismo objeto que GET /auth/me
```

| Paso | Archivo |
| --- | --- |
| cadena de la ruta | `presentation/update.routes.ts:9` |
| usuario → validación → service → respuesta | `presentation/update.controller.ts:11-31` |
| reglas | `presentation/update.service.ts:7-27` |
| escritura | `../../../shared/data/user_account.repository.ts:53-65` |

## 2. El schema es **el del registro**, no uno parecido

`domain/update.schema.ts:9-14` extiende `accountProfileShape`
(`src/modules/auth/shared/domain/account_fields.schema.ts:12-30`) con el `user_id` de la sesión y
le aplica el mismo `superRefine` (`:32-44`). No hay una segunda copia de los máximos del nombre ni
de la lista de ciudades: el día que el registro admita 140 caracteres, este formulario los admite
también, sin que nadie se acuerde de tocar dos archivos.

De ahí salen los dos casos que la fase exige y que están fijados en los tests:

- `city: OTHER` sin `city_other` → **`422`** con `fields.city_other = auth.errors.city_other_required`;
- `is_independent: true` → `organization` se guarda **`null`** aunque el cuerpo la traiga rellena
  (`resolveAccountFields`, `src/modules/auth/shared/domain/account_fields.ts:23-31`).

`is_independent` ausente vale `false`, igual que en el registro, porque el `.default(false)` está
en la pieza compartida.

## 3. El cuerpo viaja **entero**, aunque el verbo sea `PATCH`

Los cinco campos del formulario se mandan siempre juntos; `full_name` y `city` son obligatorios.
Es un `PATCH` porque parchea **el bloque de perfil** de la cuenta —no toca correo, contraseña,
rol ni foto—, no porque admita mandar medio bloque.

Un `PATCH` campo a campo suena más elegante y aquí sería peor: `is_independent` y `organization`
son **un solo dato** partido en dos columnas. Con campos opcionales, un cuerpo con
`organization: "Estudio X"` y sin `is_independent` obligaría a leer la fila para saber si esa
organización se guarda o se tira, y dos pestañas abiertas escribirían estados imposibles
(independiente **con** organización). Con el bloque entero, la regla se decide con lo que llegó.

## 4. Un `email` en el cuerpo se ignora **en silencio**

La pantalla lo dice: *"Para cambiar tu correo, escríbenos a hola@arxatec.pe"*. Aquí no se
devuelve `422`: no es culpa del usuario que un cliente mande de más, y fallar rompería la pantalla
entera por un campo que nadie pidió cambiar.

Lo que **no** pasa nunca es que se aplique, y hay **tres** cierres independientes:

1. el controller construye el objeto que se parsea **campo a campo**
   (`presentation/update.controller.ts:13-20`): `email` no se lee del cuerpo;
2. el schema no tiene `email`, así que aunque se leyera, Zod lo tiraría;
3. el `data` del `UPDATE` son cinco columnas y `email` no está
   (`../../../shared/data/user_account.repository.ts:63`).

Lo mismo vale para `id`, `role` y `email_verified_at`: el `user_id` sale de
`getAuthenticatedUser(req)` (`:12`) y nunca del cuerpo. Comprobado por `curl` y en
`tests/integration/postgres/account_flow.test.ts` (caso 2), donde después del `200` se lee el
correo **de la base** y sigue siendo el de siempre.

## 5. Los tests

- `test/update.service.test.ts` — las dos reglas (organización e `city_other`), el trim, que el
  repositorio nunca recibe `email` y que el resultado no contiene la palabra `password`.
- `test/update.controller.test.ts` — el `200`, el `email` ignorado con el `payload` exacto que
  recibe el service, los dos `422` (`city_other` y `full_name`), el default de `is_independent` y
  el `401` sin Bearer.
