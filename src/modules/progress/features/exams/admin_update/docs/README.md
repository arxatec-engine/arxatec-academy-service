# Guardar el examen

`PUT /admin/courses/:id/exam` requiere ADMIN. Recibe `expected_version` (0 al crear), `enabled`,
`passing_score` y exactamente 15 preguntas completas. Cada pregunta incluye `text`, cuatro
`options` distintas y `correct_option` de 0 a 3. La escritura bloquea el curso y compara la versión;
un conflicto devuelve 409 y conserva el registro previo. Un curso archivado no se puede editar.
