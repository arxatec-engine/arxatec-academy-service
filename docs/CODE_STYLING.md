# Code style

Academy shares Admin and Lawyer's separation of responsibilities. These conventions apply to its actual configuration: strict TypeScript, CommonJS modules, and `@/` aliases. Sources: [tsconfig](../tsconfig.json), [ESLint](../eslint.config.mjs), [Prettier](../.prettierrc), and [dependency-cruiser](../.dependency-cruiser.cjs).

## Organization and naming

- Prefer `modules/<module>/features/<feature>/<action>/` with `domain`, `presentation`, `data` when it owns persistence, `docs/README.md`, and `test`.
- Use `snake_case` directories/files: `get_list`, `update_password`, `course_mapper`. Action filenames include their layer: `register.schema.ts`, `register.service.ts`, `register.controller.ts`, `register.routes.ts`, and `register.repository.ts`.
- Exported types, interfaces, and schemas follow their unit's existing names; functions and variables use `camelCase`. Persisted fields and HTTP DTOs use `snake_case`.
- Use named exports and direct imports. Current code imports `@/utils/errors` without `.js`; the CommonJS build rewrites aliases through `tsc-alias`.
- `modules/<module>/shared` exposes data, domain, and policies used by multiple features. Do not import another module's private implementation or create a global business-logic container.

Some administrative features group actions in one controller/service. This is existing structural debt, not the recommended pattern for new actions. Splitting them must preserve routes and contracts; documentation changes do not perform that refactor.

## Responsibilities

| Component      | Responsibility                                                                   |
| -------------- | -------------------------------------------------------------------------------- |
| Router         | Chain authentication, authorization, limits, multipart, and controller.          |
| Controller     | Obtain server identity, validate input, call the service, and translate to HTTP. |
| Service        | Apply rules and coordinate repositories/ports with typed data, without Express.  |
| Repository     | Queries, selects, ordering, and transactional writes for its domain.             |
| Domain/policy  | Schemas, payloads, mappers, and pure rules.                                      |
| Infrastructure | Cryptography, email, storage, and external adapters.                             |

Async controllers let errors propagate to Express 5's handler. A `try/catch` is justified only for a concrete recovery: unique conflict, file cleanup, or tolerated email failure. Do not duplicate HTTP error handling in every slice.

## Types, validation, and contract security

TypeScript is strict. Avoid `any`, `@ts-ignore`, and casts that hide unknown contracts; validate external data before using it. Infer payloads from Zod and build DTOs with explicit selects/mappers instead of returning complete Prisma rows.

Existing schemas usually use `z.object`, which strips unknown keys. Do not describe them as strict or promise rejection of extra fields without configuring and testing that behavior. Profile controllers build the permitted fields and obtain `user_id` from the session.

Passwords are preserved exactly, without trimming or normalization. Email uses its utility/schema; accent-insensitive search uses its own normalizer. Article HTML is sanitized by policy; comments are plain text.

## Responses and errors

Use `HttpStatusCodes`, message constants, and `ErrorCodes`. JSON responses go through `buildHttpResponse({ status, description, path, data?, meta? })`; clients decide from `meta.code`, and field validation uses i18n keys in `meta.fields`.

Expected errors use `AppError`, with optional `data` for confirmation details. Locked lessons are a typed result translated by the controller into `403` with public data. CSV, OAuth redirects, and `204` retain their specific transports.

## Formatting, tests, and documentation

Use two spaces, semicolons, single quotes, a 100-column width, trailing commas, and LF. No runtime `console.log`. Explain decisions in Markdown beside the unit and in [DECISIONS](DECISIONS.md), linking to real code.

Slice tests live beside code; PostgreSQL integrations live under `tests/integration`. Mock the exact specifier imported by the implementation. Checks are documented in [TESTING](TESTING.md). Contract changes must update API documentation, relevant variables, the area README, and weekly release notes. Evidence cannot be replaced by a “ready” claim.
