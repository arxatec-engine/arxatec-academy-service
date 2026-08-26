# `src/app`, `src/routes` y `src/server.ts` — el porqué

Tres archivos que juntos son el arranque: `createApp()` monta la aplicación, `routes/index.ts`
registra los módulos y `server.ts` la escucha y la **apaga ordenadamente**.

## 1. `create_app.ts` — la cadena, y por qué se separa de `server.ts`

`createApp()` (`src/app/create_app.ts:19`) devuelve una `Express` **sin escuchar en ningún puerto**.
Ésa es toda la razón de que exista: Supertest y los tests de integración necesitan la aplicación
sin abrir un socket, y `server.ts` es el único que llama a `listen`.

El orden de la cadena (`:22-32`) es el de `02_reglas_backend.md` §6 y está razonado middleware a
middleware en `src/middlewares/docs/README.md` §0. Dos que se olvidan:

- **`app.set('trust proxy', 1)`** (`:22`). Detrás del proxy del hosting, sin esto `req.ip` es la IP
  del proxy y **todos los usuarios comparten cubo de rate limit**. El `1` es literal: se confía en
  un salto, no en toda la cadena de `X-Forwarded-For`, que la puede escribir el cliente.
- **`registerErrorHandler(app)` va después de `app.use(routes)`** (`:32-34`), nunca antes: en
  Express el 404 es "ningún router respondió".

`GET /ping` (`:31`) se monta **fuera** de `/api/v1` y antes de los routers: es el healthcheck del
orquestador, no una ruta de la API, y no debe versionarse ni pasar por el prefijo.

## 2. `routes/index.ts` — un solo sitio donde se monta un módulo

`routes` (`src/routes/index.ts:10-16`) compone el prefijo con constantes
(`ApiPrefix` + `AuthRoutePrefix`, `src/constants/endpoints.ts:1,7`), no con literales. Cambiar
`/api/v1` es cambiar una constante, y el frontend lee el mismo contrato.

`authRouter` (`src/modules/auth/index.ts:10-17`) es el router del módulo: compone los **seis
routers de feature** (registro, login, sesión, recuperación, verificación de correo y Google) que
entre todos cubren los once endpoints del contrato §4. Cada feature monta sus paths absolutos
respecto de `/auth`, y **el prefijo `${ApiPrefix}${AuthRoutePrefix}` se pone una sola vez**, aquí
(`src/routes/index.ts:12`). Un slice nuevo no toca este archivo: se engancha en el `index.ts` de su
feature y, si la feature es nueva, en el del módulo.

Que exista un router de módulo aunque no añada lógica tiene una consecuencia útil:
`/api/v1/auth/loquesea` responde el 404 **con el sobre correcto** en vez de con el HTML por
defecto de Express.

## 3. `server.ts` — el apagado ordenado

**El problema.** Un deploy manda `SIGTERM`. Si el proceso muere de golpe, las peticiones en vuelo
se cortan a medias y el pool de PostgreSQL deja conexiones colgadas del lado del servidor. No duele
hasta que duele mucho (`02_reglas_backend.md` §6).

**La forma.** Cada recurso se registra como *closeable* en el orden en que se adquiere
(`src/server.ts:64-83`): transporte de correo → Prisma → servidor HTTP. El apagado los recorre
**en orden inverso** (`:52`), que es el único orden correcto: primero se deja de aceptar peticiones,
después se sueltan las dependencias que esas peticiones usaban. Cerrar Prisma antes que el servidor
HTTP haría fallar con `500` a todo lo que estuviera en vuelo.

`server.close()` (`:24-35`) no corta las conexiones abiertas: deja de aceptar nuevas y espera a que
terminen las que hay. Por eso es lo primero y por eso puede tardar.

**El vigilante** (`:45-49`). Si algo se queda colgado, `process.exit(1)` a los
`ServerPolicy.shutdown_timeout_seconds` (`src/constants/server.ts:5`). Está `unref()`-eado a
propósito: si el apagado va bien y no queda nada vivo en el bucle de eventos, el temporizador **no**
mantiene el proceso despierto ni retrasa la salida; solo dispara si de verdad hay algo que no se
cerró.

**`process.exitCode = 0` en vez de `process.exit(0)`** (`:61`). `process.exit` mata el proceso al
instante y se lleva por delante las líneas de log que el transporte de Pino todavía no ha escrito
—incluida la que dice que el apagado terminó—. Asignando el código y dejando que el bucle se vacíe,
el log llega completo. El vigilante cubre el caso en que no se vacíe.

**Un solo apagado** (`:38-42`): `Ctrl+C` dos veces, o un `SIGTERM` seguido de `SIGINT`, no lanzan
dos secuencias de cierre en paralelo.

Un error en un `close` **no aborta el resto** (`:53-59`): se loguea con el nombre del recurso y se
sigue cerrando lo que queda. Que Prisma falle al desconectar no es razón para dejar el transporte
de correo abierto.

`uncaughtException` y `unhandledRejection` (`:91-99`) también arrancan el apagado. Un proceso que
sigue vivo tras una excepción no capturada está en un estado que nadie ha razonado; es preferible
cerrar bien y que el orquestador levante uno limpio.

## 4. `passport.initialize()` y la estrategia de Google

`passport.initialize()` está montado en la cadena (`src/app/create_app.ts:30`), pero la
`GoogleStrategy` **no se registra al importar el módulo**: se registra la primera vez que se usa
(`src/config/passport.ts`), porque `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` son opcionales en
el entorno y un `passport.use(...)` en el cuerpo del módulo tumbaría el arranque de quien solo
quiere el login por correo. El porqué completo está en
`src/modules/auth/features/google_login/docs/README.md` §5.
