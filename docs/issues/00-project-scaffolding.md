# 00 — Project scaffolding & tooling

> Part of the [implementation plan](../00-plan.md). See the
> [issue index](../01-issues.md) for ordering and dependencies.

## Goal

Stand up the Nuxt (TypeScript, SSR) application with the full tech stack wired
in, so every later issue lands on a working, lint-clean, testable foundation.

**Depends on:** — (first issue)

## Tasks

### 1. Scaffold the app

Initialise the Nuxt app into the `knowbook` folder using the official
initializer (do **not** handpick files):

```sh
pnpm dlx nuxi init knowbook --packageManager pnpm --gitInit false
```

This produces the base Nuxt + TypeScript project and installs the initial
dependencies via pnpm.

### 2. Add dependencies

Add the remaining stack packages with `pnpm add` (run from the `knowbook`
folder). Do not hand-edit `package.json`.

Runtime dependencies:

```sh
pnpm add @nuxt/ui @nuxt/icon @pinia/nuxt pinia drizzle-orm better-sqlite3
```

Dev dependencies:

```sh
pnpm add -D drizzle-kit @nuxt/test-utils vitest @vue/test-utils happy-dom \
  eslint @nuxt/eslint prettier eslint-config-prettier @types/better-sqlite3 \
  @iconify-json/ph
```

> Notes
>
> - Icons are served through `@nuxt/icon` using the Phosphor (`ph`) collection;
>   `@iconify-json/ph` bundles the icon set locally so no network fetch is
>   needed at runtime. Use as `<Icon name="ph:rss" />`. (`@nuxt/icon` also
>   underpins Nuxt UI's own icon props.)
> - `better-sqlite3` is the synchronous SQLite driver Drizzle uses in the
>   Nitro server layer.

### 3. Register modules

Configure `nuxt.config.ts` to enable the modules: `@nuxt/ui`, `@nuxt/icon`,
`@pinia/nuxt`, `@nuxt/eslint`, and `@nuxt/test-utils/module`. Enable SSR
(default) and TypeScript strict mode.

### 4. Establish project structure

Create the directory skeleton the plan assumes:

```
server/        # Nitro API routes, fetch/parse engine, config loader
  api/
  db/          # Drizzle schema + client (populated in issue 10)
stores/        # Pinia stores
components/
pages/
composables/
types/
tests/         # Vitest specs
```

Add a `.gitignore` (node_modules, `.nuxt`, `.output`, `*.sqlite`, `.env`) and a
short `README.md`.

### 5. Tooling config

- **ESLint** — flat config via `@nuxt/eslint`, integrated with Prettier
  (`eslint-config-prettier`) so formatting doesn't conflict with lint rules.
- **Prettier** — `.prettierrc` with project defaults.
- **Vitest** — `vitest.config.ts` using `@nuxt/test-utils`, `happy-dom`
  environment; one trivial smoke test that passes.
- **package.json scripts** — `dev`, `build`, `preview`, `lint`, `lint:fix`,
  `format`, `test`, `test:watch`.

### 6. Docker

- **`Dockerfile`** — multi-stage: pnpm install → `nuxi build` → slim runtime
  image running `.output/server/index.mjs` on Node 24.
- **`docker-compose.yml`** — the app service with a mounted volume for the
  SQLite database file and the app port exposed.
- **`.dockerignore`** — mirror `.gitignore` plus build artifacts.

## Acceptance criteria

- `pnpm install` succeeds on a clean checkout.
- `pnpm dev` serves the default page (SSR) without errors.
- `pnpm lint` and `pnpm format --check` pass.
- `pnpm test` runs Vitest and the smoke test passes.
- `pnpm build` produces `.output`, and `docker compose up` serves the built app.
- Directory skeleton, `.gitignore`, `.dockerignore` and `README.md` are present.

## Out of scope

- Database schema and migrations — issue 10.
- Any feature/domain logic, API routes, or UI beyond the default page.
