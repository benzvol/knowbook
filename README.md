# Knowbook

A single-user, self-hosted RSS reader. See the planning docs in
[`docs`](docs) — [`00-plan.md`](docs/00-plan.md) for the high-level plan
and [`01-issues.md`](docs/01-issues.md) for the implementation issues.

## Tech stack

Nuxt (TypeScript, SSR) · Vue · Pinia · Nuxt UI · Phosphor Icons (`@nuxt/icon`) ·
Drizzle + SQLite (`better-sqlite3`) · Vitest + Nuxt Test Utils · ESLint ·
Prettier · Docker.

## Requirements

- Node 24
- pnpm

## Setup

```sh
pnpm install
```

## Scripts

```sh
pnpm dev            # start the dev server (http://localhost:3000)
pnpm build          # production build to .output
pnpm preview        # preview the production build
pnpm lint           # ESLint
pnpm lint:fix       # ESLint with --fix
pnpm format         # Prettier write
pnpm format:check   # Prettier check
pnpm test           # run Vitest once
pnpm test:watch     # Vitest in watch mode
```

## Docker

```sh
docker compose up --build
```

The SQLite database file is persisted via a mounted volume (see
`docker-compose.yml`).

## Project structure

```
server/        # Nitro API routes, fetch/parse engine, config loader, db
app/
  components/
  composables/
  pages/
  stores/      # Pinia stores
  assets/css/  # Tailwind + Nuxt UI entry
shared/types/  # shared TypeScript types (auto-imported)
tests/         # Vitest specs
```
