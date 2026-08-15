---
id: "09"
title: Managed sources from config
description: >-
  Load app-maintainer-declared sources from a config file, reconciled at
  startup, with native filter support: a query template plus a filter schema of
  allowed values, so a source's own filtering API becomes a guided form instead
  of a hand-typed JSON blob.
status: todo
dependencies: ["03", "05"]
affects: [app, server, db, tests, config]
---

# 09 — Managed sources from config

> Part of the [implementation plan](../00-plan.md). See the
> [issue index](../01-issues.md) for ordering and dependencies.

## Goal

Let the app **maintainer** declare sources in a config file — URL, title,
pagination, query params, item tags, subfeeds — reconciled into the DB at
startup, with the user choosing which to load into their own sources list. The
config is the extension point for handling individual sources' quirks in a
plugin-like way, without a user-facing write path and without a migration per
source.

The substantial new capability here is **native filter support**. A source's own
filtering API is currently something the user has to reverse-engineer and type
by hand: to get telex.hu's G7 section today you must know to put

```json
{ "filters": "{\"superTagSiteSlugs\":[\"g7\"]}" }
```

into a subfeed's `queryParams` — a JSON string, nested inside a JSON object,
with no discoverability and no validation beyond "is it a string". A managed
source can instead declare **how** its filter param is built (a query template)
and **what** may go in it (a filter schema of allowed values), turning subfeed
authoring into a form of labelled selects.

**Depends on:** 03 (source management), 05 (subfeeds — filter templates exist to
author subfeeds).

**Not user-facing, system-defined.** Templates and schemas live only in the
config file. `managed` stays server-owned exactly as
[04b](./04b-simplify-classification.md) established: absent from
`shared/schemas/source.ts`, so a `managed` key in a request body is silently
stripped. Users cannot create or edit managed sources, and the
_"save as managed"_ promotion remains **dropped** — once export exists
(issue 10), a script can lift a source's properties out of an export into the
config file.

## Tasks

### 1. Config file and loader

- Config location read from an env var (`MANAGED_SOURCES_PATH`, defaulting to
  `./config/managed-sources.json` or `.ts`) so a Docker deployment can mount it
  alongside the SQLite volume. There is no `server/config/` directory yet — this
  issue creates the whole seam.
- `shared/schemas/managedSource.ts` — the Zod schema for one config entry, and
  the file as a whole. It **extends** rather than replaces
  `sourceCreateSchema`: same `url`/`title`/`pagination`/`queryParams` shapes, plus
  the config-only fields below. Validating the config with the same Zod layer the
  API uses means a malformed config fails loudly at startup rather than producing
  a half-loaded source.
- `server/config/managedSources.ts` — read + validate + return typed entries.
  A missing config file is not an error (the common case is not having one); a
  malformed one is.
- Reconcile at startup from a Nitro plugin, next to
  `server/plugins/migrate.ts` and ordered after it. Reconciliation is keyed on a
  stable config-declared `slug` (not the URL, which a maintainer may fix, and not
  the DB id, which the config can't know) — so `sources` gains a nullable
  `slug` column, unique where non-null.

Reconciliation semantics to decide and write down:

- A config entry the user has **not** loaded is available but absent from
  `sources`; loading it is an explicit user action (`POST /api/managed/:slug/load`).
- A loaded entry whose config changed has its **maintainer-owned** fields
  (url, pagination, queryParams, filter template/schema) overwritten on the next
  startup — that is the point of managed sources. The user's own additions to it
  (tags they attached, feeds it belongs to, cached items) are preserved.
- An entry that disappears from the config does **not** delete the user's
  source; it is demoted (`managed` → false) so it stops being reconciled and
  becomes editable. Silently deleting a source the user reads would be the wrong
  default.

### 2. Query template + filter schema

The two config-only fields that make a source's filtering native. Using
telex.hu as the worked example:

```ts
{
  slug: 'telex-archivum',
  url: 'https://telex.hu/rss/archivum',
  title: 'Telex',
  pagination: { pageParam: 'oldal', sizeParam: 'perPage' },

  // Renders into `queryParams`: one entry per param the template drives.
  // The value is a template, the key is the query-param name.
  queryTemplate: {
    filters:
      '{"superTagSiteSlugs":[{{{json sites}}}],"superTagSlugs":[{{{json superTags}}}],"tagSlugs":[{{{json tags}}}]}',
  },

  // What may go in the template's variables, and how to render the controls.
  filterSchema: {
    sites: { type: 'array', label: 'Sites', values: ['g7', 'karakter', 'after'] },
    superTags: { type: 'array', label: 'Super tags', values: ['techtud', 'adat', 'penz'] },
    tags: { type: 'array', label: 'Tags', values: ['...'] },
  },
}
```

Decisions and gotchas worth settling before writing code:

- **`filterSchema` is a small purpose-built descriptor, not JSON Schema**, despite
  reading like one. Real JSON Schema would spell the same thing
  `{ type: 'array', items: { enum: [...] } }` and buy validation Zod already
  gives us, at the cost of a much noisier config and a resolver dependency.
  Validate the descriptor with Zod in `shared/schemas/managedSource.ts`. Revisit
  only if the config ever needs to interop with something external.
- **Handlebars escapes by default.** `{{ sites }}` HTML-escapes its output,
  turning `"` into `&quot;` and silently producing a broken query param. Use the
  triple-stache (`{{{ }}}`) together with a `json` helper that returns a
  `SafeString` of properly quoted, comma-joined values. This is the single
  easiest thing to get wrong here, so the helper — not the caller — owns quoting.
- **A real template engine earns its place through conditionals.** A naive
  string interpolator would be smaller, but some APIs need a param *omitted*
  rather than sent empty, which needs `{{#if}}`. Prefer Handlebars for the
  known syntax the config author already expects; require that a param whose
  rendered value is empty or degenerate (`{}`, `[]`, all-empty arrays) is dropped
  from `queryParams` rather than sent. Telex tolerates `[]`; not every source will.
- **Render at save time, not fetch time.** Store the rendered result in the
  subfeed's existing `queryParams` and keep that the single source of truth for
  fetching, so `subfeedTarget`, `pagination.ts`, `refresh.ts` and `search.ts` are
  completely untouched by this issue. Rendering at fetch time would give the feed
  engine a dependency on the config loader and would let a config edit silently
  change what an existing saved subfeed requests.
- **Also store the structured selection**, so the form can round-trip: `subfeeds`
  gains a nullable `filterValues` JSON column holding
  `{ sites: ['g7'], superTags: [] }`. Without it, editing a subfeed created from
  a template means re-deriving selections by parsing the rendered param, which is
  the template run backwards and not generally possible.
- **Validate selections against the schema on save**, rejecting values absent
  from `values`. A maintainer trimming a `values` list must not leave a saved
  subfeed silently requesting a slug the site no longer knows.
- `server/feed/filterTemplate.ts` — `renderFilters(queryTemplate, filterSchema,
  filterValues): QueryParams`. Pure and synchronous, so it tests without a DB or
  network, in the spirit of `server/feed/view.ts`.

### 3. Schema-driven subfeed authoring UI

- `app/components/subfeeds/SubfeedForm.vue` currently always renders the raw
  `QueryParamsEditor`. When the parent source is managed **and** carries a
  `filterSchema`, swap it for controls generated from that schema — a
  `USelectMenu` (multiple) per `array` field, labelled from `label`, its items
  from `values`. Non-managed sources keep the raw editor unchanged; this is
  additive, not a replacement.
- Show the **rendered** param read-only beneath the controls, so the user can see
  exactly what will be requested. It is the same information the effective-params
  list already shows on `app/pages/sources/[id]/subfeeds.vue`, and it is what
  makes an opaque template trustworthy.
- Config-declared subfeeds carry `filterValues` directly and are rendered by the
  loader, going through the same `renderFilters` path as the UI — one
  implementation, two callers.

### 4. Managed-source browsing and loading

- `GET /api/managed` — the config entries, each flagged with whether it is
  already loaded.
- `POST /api/managed/:slug/load` — create the source (and its declared subfeeds)
  from config, `managed: true`.
- A page listing available managed sources with a Load action, plus a badge on
  managed rows in the existing source list so it is obvious why Edit is
  unavailable.
- The source form and row menu must **refuse** edits to a managed source, in the
  API as well as the UI — the UI hiding a button is not enforcement.

### 5. Reserved seams

Keep [`00-plan.md`](../00-plan.md)'s promise that the config schema reserves room
for later work without a migration: accept and persist (unused) optional
`scrape` and `tts` objects on a config entry. Issue 12 gives `scrape` its actual
meaning for user-created sources; reserving the key here keeps a managed source
able to declare the same thing later.

## Testing

- **Config loading** (`tests/config/managedSources.spec.ts`, new): a valid file
  parses; a malformed one throws with a useful message; a missing file yields no
  entries rather than throwing.
- **Template rendering** (`tests/feed/filterTemplate.spec.ts`, new): pure, no DB
  — the telex example renders the exact param string the site expects,
  including correct quoting for multi-value arrays; a `json` helper output is not
  HTML-escaped; an all-empty selection omits the param entirely; a value absent
  from the schema's `values` is rejected; a template variable with no schema
  entry is rejected (a typo in the config, caught at startup).
- **Reconciliation** (`tests/db/` + a loader spec, against `createTestDb()`):
  loading an entry creates the source and its subfeeds; a second startup with a
  changed config overwrites maintainer-owned fields while preserving the user's
  attached tags, feed membership and cached items; an entry removed from config
  demotes rather than deletes; `slug` uniqueness is enforced.
- **Server** (`tests/api/managed.spec.ts`, new): `GET /api/managed` flags loaded
  entries; loading twice is a 409 rather than a duplicate; `PATCH`/`DELETE`
  against a managed source is refused with a 4xx even when the client sends it
  directly.
- **Component** (`tests/nuxt/`): `SubfeedForm` renders schema-driven selects for a
  managed parent with a `filterSchema` and the raw `QueryParamsEditor` otherwise;
  the rendered-param preview updates as selections change.

## Acceptance criteria

- Managed sources are declared in a config file, validated at startup with the
  same Zod layer the API uses, and reconciled onto a stable `slug`.
- The user can browse available managed sources and load one; they cannot create
  or edit any managed source, enforced in the API and not merely hidden in the UI.
- A managed source can declare a query template plus a filter schema, and
  authoring a subfeed of it is a form of labelled selects over allowed values —
  no hand-typed JSON — with the resulting query param shown before saving.
- The telex.hu case is expressible end-to-end: selecting site `g7` produces
  exactly the `filters` param the site expects, and refreshing that subfeed
  returns G7 items.
- Rendering happens at save time into the existing `queryParams`, leaving the
  feed engine (`pagination.ts`, `refresh.ts`, `search.ts`, `target.ts`)
  unchanged.
- A config change to a loaded source's maintainer-owned fields takes effect on
  restart without destroying the user's tags, feed membership or cached items.
- Typed end-to-end with no `any` leaks; `pnpm test`, `pnpm lint` and `pnpm build`
  pass; runs under Docker Compose with the config mounted.

## Out of scope

- **Discovering** a source's allowed filter values by scraping its own filter UI —
  `values` are maintainer-declared and static. A stale list is a config edit.
- Filter types beyond what the config actually needs: start with `array`
  (multi-select over `values`), add `string`/`enum`/`boolean` only when a real
  source requires one.
- Any user-facing write path to `managed`, and the dropped _"save as managed"_
  promotion (see 04b and issue 10's export instead).
- Per-source executable plugins (custom parse/fetch code per source). The config
  stays declarative data; a source needing real code is a reason to extend the
  engine, not to eval config.
- Article-content scraping and TTS — reserved as config keys only (task 5).
  Listing-page scraping for **user-created** sources is issue 12.
- Scheduled/background refresh of managed sources — still issue 09+ territory in
  the plan, but not this issue.
