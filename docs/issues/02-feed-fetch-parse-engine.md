---
id: "02"
title: Feed fetch & parse engine
description: >-
  Build the server-side engine that fetches, parses, paginates, and caches
  RSS/Atom feed items into SQLite, laying the foundation for
  search-until-found paging used by later views.
status: done
dependencies: ["01"]
affects: [server, tests]
---

# 02 — Feed fetch & parse engine

> Part of the [implementation plan](../00-plan.md). See the
> [issue index](../01-issues.md) for ordering and dependencies.

## Goal

Build the server-side engine that fetches a remote RSS/Atom feed, parses it into
the normalised `Item` shape from issue 01, and caches items in SQLite. Wrap the
request in a reusable **pagination abstraction** that maps standard and
source-specific custom query params onto page requests, and lay the foundation
for _search-until-found_ paging consumed later by the shared content views
(issue 07). No HTTP API routes, Pinia stores, or UI yet — this is a pure server
module with its own tests.

**Depends on:** 01 (persistence & data layer).

## Tasks

### 1. Feed fetching

Add a server-only fetch layer under `server/feed/` that retrieves a feed URL:

- `server/feed/fetch.ts` — fetch a fully-composed URL using the runtime `fetch`,
  with a sensible `User-Agent`, request timeout (via `AbortSignal`), and typed
  errors distinguishing network failure, non-2xx status, and empty body.
- The browser never fetches remote feeds directly (CORS + server-side parsing);
  everything here runs in Nitro.
- Return the raw response body plus `contentType` so the parser can pick a
  format. Do not follow pagination here — that is the engine's job (task 3).

### 2. Parsing & normalisation

Parse RSS 2.0 and Atom 1.0 into the shared `Item` shape:

- `server/feed/parse.ts` — detect format and map entries to
  `NewItem`-compatible objects: `guid` (falling back to `link` when absent),
  `title`, `description`, `link`, `publishedAt` (parsed to `Date`), and leave
  `tags`/`sourceId`/`fetchedAt` to the caller.
- Use a small, well-maintained parser dependency (add via `pnpm add`; e.g.
  `fast-xml-parser` as a low-level base, or a dedicated feed parser — decide at
  impl and document the choice) rather than hand-rolling XML parsing.
- Normalisation is source-agnostic: the output `Item` shape is identical
  regardless of feed format, so views/search/bookmarks never branch on format.
- Be defensive about missing/partial fields and malformed dates; a single bad
  entry must not fail the whole parse.

### 3. Pagination abstraction

A single reusable abstraction that turns a `Source` (its base URL,
`PaginationConfig`, and `queryParams` from issue 01) into successive page URLs:

- `server/feed/pagination.ts` — given a source and a page number, build the
  request URL by appending the configured page param (`pageParam`), page-size
  param (`sizeParam` + `pageSize`), any static `queryParams`, and respecting
  `startPage` (0- vs 1-based indexing).
- Expose an iterator/generator that yields fetched-and-parsed pages lazily so
  callers pull only as many pages as they need. This same iterator backs both
  ordinary list paging and _search-until-found_.
- Standard feeds without pagination config resolve to a single page (the base
  URL) — pagination is opt-in per source.

### 4. Search-until-found foundation

Provide the primitive that issue 07's search builds on, without the UI:

- A function that walks pages via the iterator, applies a predicate (e.g. a
  title/description substring match), and stops at the first match **or** a
  configurable max-page cap, returning what it found plus whether the cap was
  hit.
- Keep the predicate injectable so the actual search semantics (case handling,
  fields searched) can evolve in issue 07 without touching the engine.

### 5. Item caching

Persist fetched items through the issue 01 repositories:

- After fetching+parsing a page, upsert each item via `upsertItem`
  (dedup by `(sourceId, guid)`), stamping `sourceId` and `fetchedAt`.
- A `refreshSource(sourceId, { maxPages })`-style entry point that fetches,
  parses, and caches, returning a summary (items seen / inserted / updated).
- Reads for views come from the cache (SQLite), decoupling display from remote
  availability; refresh is an explicit operation (wired to API/scheduling in a
  later issue).

### 6. Engine entry point

- `server/feed/index.ts` — barrel exposing the public surface
  (`refreshSource`, the page iterator, the search primitive, parse/fetch
  helpers) so later issues import one module.
- Functions are typed end-to-end against the shared `Item`/`Source` types with
  no `any` leaks.

## Testing

- Unit tests under `tests/feed/` using **fixture feeds** (sample RSS 2.0 and
  Atom 1.0 XML strings/files), not live network:
  - parse: RSS and Atom fixtures map to the expected normalised `Item`s;
    missing `guid` falls back to `link`; malformed dates/entries are tolerated.
  - pagination: URL construction honours `pageParam`/`sizeParam`/`pageSize`/
    `startPage` and merges static `queryParams`; no-config source yields one
    page.
  - search-until-found: stops at first match; stops at the max-page cap and
    reports the cap was hit.
  - caching: `refreshSource` against an in-memory DB (issue 01 test helper)
    upserts and dedupes by `(sourceId, guid)` on repeat runs.
- The fetch layer is exercised via an injected/mocked fetch so tests stay
  offline and deterministic.

## Acceptance criteria

- Given a fixture RSS/Atom body, the engine produces normalised `Item`s and
  caches them via the issue 01 repositories.
- The pagination abstraction builds correct page URLs from a source's config and
  drives both list paging and search-until-found through one iterator.
- Search-until-found returns the first match or halts at the configurable page
  cap, signalling which occurred.
- Re-running a refresh does not duplicate items (upsert by `(sourceId, guid)`).
- `pnpm test`, `pnpm lint`, and `pnpm build` all pass.

## Out of scope

- HTTP API routes, Pinia stores, and UI — issue 03 (source management) exposes
  the first vertical slice.
- Filtering / sorting / the search **UI** and page cap setting — issue 07.
- Scheduled/background refresh and managed-source config — issues 09+.
- Content scraping and TTS (only the normalised `Item` seam is prepared).
