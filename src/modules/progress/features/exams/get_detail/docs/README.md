# Examen del alumno

`GET /courses/:slug/exam` requiere sesión y un curso publicado. Devuelve el estado de acceso
y el último resultado del usuario autenticado. Solo entrega enunciados y opciones cuando el
examen está activo y se completaron todas las lecciones publicadas; nunca entrega la clave
correcta ni el histórico interno. Un certificado ya emitido mantiene el estado `passed`.
En ese estado, la nota corresponde al intento aprobado que emitió el certificado.
