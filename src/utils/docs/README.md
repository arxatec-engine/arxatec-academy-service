# `src/utils` — el porqué

Cinco helpers transversales, sin estado. La regla que los mantiene pequeños está en
`02_reglas_backend.md` §9.4: **la lógica de negocio de un dominio no va a `utils`**. Un helper
llega aquí solo si lo usan varios módulos y no pertenece a ninguno.

`no-utils-to-modules` en `.dependency-cruiser.cjs` impide que `utils/` importe de `modules/`,
`app/`, `routes/` o `middlewares/`: si un util necesita eso, no era un util.

**No hay `src/utils/index.ts`.** Se importa el submódulo:
`import { AppError } from '@/utils/errors'` (`02_reglas_backend.md` §8).

## 1. `errors.ts` — un solo tipo de error de dominio

`AppError` (`src/utils/errors.ts:9-20`) lleva tres cosas: el texto para humanos, el `statusCode`
y un `meta` opcional. El `meta.code` (`src/utils/errors.ts:3-7`) es lo único por lo que ramifica
el frontend, porque el texto cambia con el idioma (`04_contrato_api_auth.md` §1).

`meta` es **más ancho que `{ code }`** a propósito, y las dos extensiones vienen del contrato:

- `fields?: Record<string, string>` → lo que el `422` necesita para pintar el error debajo del
  campo correcto (`04_contrato_api_auth.md` §5).
- `retry_after_seconds?: number` → lo que el `429 RESEND_COOLDOWN` necesita para que la pantalla
  07 arranque su cuenta atrás sin inventarse el número (`04_contrato_api_auth.md` §4, endpoint 8).

`Object.setPrototypeOf(this, new.target.prototype)` (`src/utils/errors.ts:17`) no es ceremonia:
al compilar clases que extienden `Error` a un `target` anterior a ES2015 —y al pasar por SWC en
los tests— la cadena de prototipos se pierde y `error instanceof AppError` devuelve `false`. Sin
esa línea, el manejador global trataría todo error de dominio como un `500`.

`this.name = new.target.name` (`src/utils/errors.ts:14`) usa el nombre real de la subclase en vez
de una cadena fija, para que una futura subclase no herede el nombre equivocado en el log.

`isAppError` (`src/utils/errors.ts:22`) existe para que el manejador global y los tests no
repitan el `instanceof` y para estrechar `unknown` sin un cast.

## 2. `build_http_response.ts` — el sobre, y solo el sobre

`buildHttpResponse` (`src/utils/build_http_response.ts:28`) devuelve exactamente los campos de
`04_contrato_api_auth.md` §1, **en ese orden**, y no admite variantes por endpoint.

Toma **un objeto**, no argumentos posicionales. Con cinco parámetros de los cuales tres son
opcionales, la llamada posicional acaba en `buildHttpResponse(status, desc, path, undefined, meta)`,
que es justo la línea que nadie relee. Con objeto, la llamada dice qué es cada cosa.

`data` y `meta` se añaden **solo si no son `undefined`** (`src/utils/build_http_response.ts:43-49`).
Escribirlos siempre metería `"data": undefined` en el objeto: `JSON.stringify` lo borra, pero
cualquier test que compare el objeto antes de serializar fallaría por una clave fantasma.

`timestamp` se calcula aquí (`src/utils/build_http_response.ts:41`) y no lo pasa el controller:
es el único modo de que las 11 respuestas usen el mismo formato ISO.

## 3. `safe_redirect.ts` — la función pura del `redirect_to`

`04_contrato_api_auth.md` §7 lo exige: el destino de retorno se valida **en los dos lados**, en
el backend con una función pura y testeada. El test vive en
`src/utils/test/safe_redirect.test.ts` y es el que da sentido a esta carpeta.

Un `redirect_to` sin validar convierte el login en un **redirector abierto**: el atacante manda
`…/ingresar?redirect_to=https://arxatec-academy.malo.pe`, la víctima ve un dominio legítimo en
la barra, inicia sesión y aterriza en una copia del producto. Es phishing con la marca propia
como cebo.

`RELATIVE_PATH_PATTERN` (`src/utils/safe_redirect.ts:4`) es `/^\/(?!\/)[^\s\\]*$/`, y cada trozo
tapa un vector distinto:

| Trozo | Qué rechaza | Ejemplo |
| --- | --- | --- |
| `^\/` | cualquier cosa con esquema o sin `/` inicial | `https://malo.pe`, `javascript:alert(1)` |
| `(?!\/)` | la URL protocol-relative | `//malo.pe` → el navegador la resuelve como `https://malo.pe` |
| `[^\\]` | la barra invertida en **cualquier** posición | `/\malo.pe` → Chrome y Safari normalizan `\` a `/`, así que equivale a `//malo.pe` |
| `[^\s]` | espacios y saltos de línea | inyección de cabeceras en el `Location` |

`hasControlCharacters` (`src/utils/safe_redirect.ts:6-15`) recorre los puntos de código en vez de
meter un rango `\x00-\x1f` en la clase del regex. Dos motivos: `\s` **no** cubre `\x00`-`\x08`, y un
rango de control dentro de un regex dispara `no-control-regex` de ESLint, que solo se podría
callar con un `eslint-disable` — y aquí no hace falta ninguno.

El tope de longitud sale de `AuthPolicy.redirect_to_max_length`
(`src/constants/auth.ts:19`): un `redirect_to` de 8 KB no es un destino, es un intento de llenar
una cookie o un log.

`sanitizeRedirect` (`src/utils/safe_redirect.ts:33`) es la puerta que usan los slices: nunca
lanza, siempre devuelve algo navegable, y su repliegue por defecto es `FrontendRoutes.home`. Un
destino inválido no es un error del usuario que merezca una pantalla: es ruido que se ignora.
`isSafeRedirect` queda expuesto para cuando el slice sí quiere distinguir (por ejemplo, el
`state` de Google).

## 4. `authenticated_user.ts` — el usuario de la sesión, sin casts ni `try/catch`

`02_reglas_backend.md` §4 lista `authenticated_user` entre los archivos de `utils/`, y §3 fija el
orden del controller: **usuario → validación → service → respuesta**. Este archivo es el primer
paso de ese orden.

`getAuthenticatedUser` (`src/utils/authenticated_user.ts:9`) devuelve `req.user` o lanza
`401 UNAUTHENTICATED`. `req.user` está tipado como `AuthenticatedUser | undefined`
(`src/types/express.d.ts:5`, `src/types/authenticated_user.ts:3-9`), así que sin este helper cada
controller autenticado tendría que estrechar el `undefined` a mano —y la vía rápida para hacerlo
es el `!` o un cast, que es exactamente lo que prohíbe `01_reglas_globales.md` §4—.

En la práctica el `undefined` no ocurre: `authenticateTokenJwt` ya rechazó la petición antes de
llegar al controller. El helper existe para que **el tipo lo diga**, y para que una ruta a la que
se le olvidó el middleware falle con el `401` del contrato en vez de con un `TypeError` que se
convertiría en un `500`.

`getOptionalUser` (`src/utils/authenticated_user.ts:19`) es su hermano para las rutas **públicas
con Bearer opcional**: devuelve el usuario o `null`, sin lanzar. Lo estrenó `GET /courses/:slug`
(fase 09), donde la sesión no da acceso a nada nuevo —solo cambia `is_unlocked` en el temario— y
por tanto no puede ser un requisito. Existe por la misma razón que `getAuthenticatedUser`: sin él,
el controller escribiría `req.user !== undefined` a mano, y la diferencia entre "esta ruta es
opcional" y "a esta ruta se le olvidó el middleware" dejaría de estar escrita en ningún sitio.

`assertVerifiedEmail` (`src/utils/authenticated_user.ts:21-29`) es el `403 EMAIL_NOT_VERIFIED` del
contrato §5. La regla vive aquí —una función pura sobre `AuthenticatedUser`, sin Express— y su
punto de montaje es el middleware `requireVerifiedEmail`
(`src/middlewares/require_verified_email.ts:5-13`), que la estrenó la fase 12 en las dos rutas de
escribir un comentario.

> **Corregido en la fase 12.** Este párrafo decía que la función vivía aquí *"y **no** en un
> middleware"*, y que un middleware *"invita a montarlo en un router entero"*. El riesgo es real
> pero se evita mirando dónde se monta, no prohibiendo la forma: `requireVerifiedEmail` se declara
> **ruta a ruta**, nunca con `router.use()`, y no está en las otras dos rutas del módulo de
> comentarios (listar y reportar). D-006 sigue intacta: verificar el correo **no** bloquea el
> acceso, solo las dos acciones que escriben en un hilo. La función se renombró a
> `assertVerifiedEmail` para que el nombre `requireVerifiedEmail` quede libre para el middleware,
> igual que `requireAdmin` (`src/middlewares/require_admin.ts:10-24`).

## 5. `request_body.ts` — leer un campo del cuerpo sin creerse su tipo

`readBodyField` (`src/utils/request_body.ts:1-2`) devuelve `unknown`: mira que `req.body` sea un
objeto, que la clave exista, y entrega el valor **sin afirmar nada sobre él**. Quien decide si es
un `string` de 1 a 2 000 caracteres es el schema de Zod del slice, que es el único sitio donde
está escrito el contrato de entrada.

Existe porque `req.body` es `any` en Express 5 y desestructurarlo directamente mete un `any` en el
controller —lo que prohíbe `01_reglas_globales.md` §4—. La alternativa que había, y que la fase 12
retiró, era **la misma función copiada dentro de cada controller** (estaba en
`modules/progress/.../update.controller.ts` desde la fase 11): con tres controllers nuevos de
comentarios habrían sido cuatro copias de dos líneas idénticas. No es lógica de dominio, no toca
Prisma y no sabe de ningún módulo, así que cumple `02_reglas_backend.md` §9.3.

**No vale para todo cuerpo.** Un slice cuyo cuerpo entero es el contrato —`register`, por
ejemplo— hace `Schema.parse(req.body)` y no necesita este helper
(`modules/auth/features/registration/register/presentation/register.controller.ts:11`). Este es
para los controllers que **mezclan** cuerpo, ruta y sesión en un solo `parse`.
