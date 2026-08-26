# `features/report` — el porqué

Una sola action: `POST /api/v1/comments/:id/report`, con Bearer y sin más requisitos.

Es una feature aparte de `thread` porque **no escribe en la conversación**: no produce nada que
nadie vea, no gasta el cupo de comentarios y no exige el correo verificado. Lo que produce es una
señal privada para la moderación (pantalla 15, fase 16), y meterla en `thread` mezclaría dos
audiencias —el visitante y el admin— bajo la misma carpeta.

`index.ts:5-7` exporta `commentReportRouter`; el módulo lo monta bajo `CommentsRoutePrefix`
(`../../index.ts:11`). El porqué de cada decisión está en `create/docs/README.md`.
