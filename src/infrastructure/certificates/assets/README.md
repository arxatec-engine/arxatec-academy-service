# Marca y tipografía de los certificados

El logo Academy y las fuentes Regular/Medium son los mismos recursos de `arxatec-ui` 0.1.72
que utiliza la vista previa web. `academy_logo.json` conserva sus paths y separador originales.
Las fuentes WOFF2 de la biblioteca se descomprimieron a TTF para incrustarlas correctamente
en PDF, conservando glifos y métricas. El servicio no necesita Python para generar documentos.

El build copia este directorio a `dist/infrastructure/certificates/assets`. La generación es
local y no depende de fuentes del sistema ni de recursos descargados durante cada petición.
