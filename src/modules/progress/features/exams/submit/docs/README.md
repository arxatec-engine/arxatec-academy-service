# Corregir un intento

`POST /courses/:slug/exam/attempts` requiere sesión y limita envíos por usuario. El controller
valida versión y 15 respuestas; toma la identidad de la sesión y rechaza campos extra como
identidad, nota o aprobado. La corrección, persistencia del intento y emisión
del certificado se hacen en una transacción. Solo el servidor decide si se alcanza la nota mínima.
Los resultados de un intento fallido no incluyen respuestas correctas y permiten volver a intentar.
