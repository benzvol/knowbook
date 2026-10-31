---
id: "10"
title: Export & import
description: >-
  Download all persisted Knowbook data from Settings and selectively import a
  versioned JSON file using merge or replace. Before replace, automatically
  download a complete backup of the receiving instance.
status: todo
dependencies: ["03", "05", "06", "08", "11"]
affects: [app, server, tests]
---

# 10 — Export & import

> Part of the [implementation plan](../00-plan.md). See the
> [issue index](../01-issues.md) for ordering and dependencies.

## Goal

Put Export and Import in the existing Settings tab/page. Exports contain all
persisted app data: sources, subfeeds, feeds, bookmarks, tags, settings, cached
items, and all relationships. Import has six section checkboxes, all checked
initially, and **Merge** / **Replace** radios. Replace first automatically
downloads a complete export of the receiving instance with `backup` in its
filename, then replaces only the final visible selected sections atomically.

**Depends on:** 03 (sources), 05 (subfeeds), 06 (composed feeds), 08 (bookmarks),
and 11 (Settings). Issue 09 is not a prerequisite; account for its future config
ownership without excluding loaded managed sources from exports.

## Tasks

### 1. Define a complete, versioned JSON format

Create `shared/schemas/transfer.ts` with strict schemas for the document,
selection, mode, preview, and result. Use `format: 'knowbook-backup'`,
`version: 1`, `app: 'Knowbook'`, and `exportedAt` as a UTC ISO 8601 timestamp.
Every section is required, even when empty. Dispatch explicitly by version;
unsupported versions fail before writes.

Use file-local IDs/references to preserve distinct records, even those sharing
a URL or name. Never insert these IDs directly into another database; build
destination ID maps. Store dates as ISO strings, preserving nulls, and convert
back to the database's epoch-millisecond convention.

| Import checkbox | Data owned by the section |
| --- | --- |
| Sources | Definitions, pagination, query params, timestamps/last visits, source-tag assignments, and all cached items for these sources. |
| Subfeeds | Definitions, parent references, params, timestamps/last visits, and item/subfeed memberships. |
| Feeds | Composed feed definitions, timestamps/last visits, and source/subfeed memberships. |
| Bookmarks | Item references, manual order, creation dates, and bookmark tags. |
| Tags | The complete global tag catalog, including unattached tags. |
| Settings | All persisted settings key/value records. |

Preserve cached article GUIDs, descriptions, links, publication/fetch dates,
images, and inline item tags, including articles without bookmarks. Explain
that Sources includes cached articles and show their count in preview.
Inline item/bookmark tags are string arrays in the current model, separate
from the global catalog; they travel with their owning records. Source-tag
assignments travel with Sources.

Export stored settings rather than effective defaults; an absent key remains
absent and uses the app default. Validate known keys using
`shared/schemas/settings.ts` and preserve other stored JSON-compatible keys
through the transfer service without broadening the regular Settings PATCH
API. Invalid known values produce a useful error rather than silent changes.

Include loaded managed-source definitions and persisted data. Import cannot
grant config ownership: reuse a matching receiver-managed source without
overwriting config-owned fields; restore an unmatched managed snapshot as an
ordinary source and report the conversion. Apply the same rule to future
config-owned subfeeds. Expose config conflicts during preview. Import never
rewrites the receiver's external managed-source config file.

### 2. Implement complete export and predictable filenames

Create `server/transfer/export.ts` to read all tables in one consistent
database snapshot and serialize the shared format. Inject the database and
clock for tests. Reuse it for manual exports and automatic backups; neither
path fetches remote feeds. Add `GET /api/transfer/export` with JSON content type
and attachment headers.

Normal filenames: `knowbook-backup-<ISO timestamp>.json`.
Automatic backup filenames: `knowbook-backup-<ISO timestamp>.json`.
Use UTC ISO 8601 basic notation in filenames, for example
`knowbook-backup-20261031T143025.123Z.json`, preserving a valid ISO timestamp
without filesystem-hostile colons. Use the usual extended timestamp
(`2026-10-31T14:30:25.123Z`) in the document metadata.

Both exports contain all data regardless of import selections. Automatic
backups must be accepted by the same importer.

### 3. Validate, preview, and restrict dependent selections

Create `server/transfer/validate.ts` and `plan.ts`. Validate the complete file
before planning writes: shape/version, dates, unique file-local IDs, valid
references, matching source ownership for item/subfeed links, memberships,
and settings. Enforce a documented configurable upload byte limit before
parsing, mirrored client-side for usability.

Add `POST /api/transfer/preview` accepting the document, selection, and mode.
Return counts, planned creates/updates/removals, ownership warnings, and
selection requirements without changing app data.

Enforce these import prerequisites in both UI and server:

- Subfeeds requires Sources, for parent definitions and cached article links.
- Feeds requires Sources when memberships exist, and Subfeeds when any
  memberships are narrowed to subfeeds.
- Bookmarks requires Sources, for the bookmarked article and its parent.
- Sources requires Tags when source-tag assignments use the catalog.
- Settings is independent. Tags alone may be merged without Sources.

All six boxes start checked. Unchecking a prerequisite also unchecks and
disables dependent options, with an explanation beside them. Rechecking a
prerequisite enables dependents without automatically selecting optional
sections. An empty overall selection cannot be submitted.

Replace also needs restrictions based on the receiver's references. Preserve
destination IDs for matched records and inspect references before removing
unmatched records. If replacing a parent would cascade into an unchecked
section, require that section too, transitively. Show these extra required
boxes checked and locked with the reason, before the final Import action.
Recompute from the file, mode, receiver state, and user's root selections;
release locks when their cause disappears. Keep the explicit user selections
separate from computed requirements so the UI does not get stuck in cycles.

For example, replacing Sources can require Subfeeds, Feeds, and Bookmarks;
replacing Tags used by retained Sources can require Sources. Replacing
Bookmarks does not delete existing Sources. Settings-only replacement needs
no other selection. Unresolvable references, ambiguous matches, or protected
config conflicts block submission with an explanation. Never disable foreign
keys or silently skip relationships. Direct API requests omitting required
sections fail and return the requirements instead of applying hidden changes.

### 4. Implement deterministic Merge and selective Replace

Create `server/transfer/import.ts`, using the current synchronous
Drizzle/better-sqlite3 transaction model and injected `DB`. Existing
repositories accept a database parameter; every write must use the transaction.
Avoid helpers that reset timestamps, drop fields, or append bookmark order
when restoring exact exported values.

Match across instances by exact source URL, subfeed name within its mapped
source, feed name, tag name, item GUID within its mapped source, bookmark item
identity, and setting key. Source URLs and some names are not database-unique:
multiple possible matches are conflicts, not permission to pick the first.
Preserve distinct file records and reject ambiguous mappings without writes;
do not normalize distinct URLs into one identity.
On a fresh destination or full replacement without retained references,
recreate distinct file records without deduplicating them; only require a
unique cross-instance match when reconciling with retained records.

**Merge:** imported values update matching selected records; missing records
are created and destination-only data remains. Union source-tag assignments,
feed memberships, and item/subfeed links without duplicates. Imported inline
tag arrays replace those of matching selected records. Reimporting the same
file is idempotent. Preserve existing bookmarks' relative order and positions;
update matching metadata and append new bookmarks in exported relative order.
Upsert imported setting keys, leaving other keys untouched. An empty selected
section is a no-op.

**Replace:** selected sections match the file, removing receiver-only records,
replacing owned relationship sets, and restoring exported bookmark order.
An empty selected section clears that section. Settings replacement removes
receiver-only persisted keys; absent known keys use normal defaults. Unchecked
sections retain their records, values, and relationships. Config-owned
definitions follow the ownership rules above, with conflicts exposed before
writes.

Plan across the complete selected graph, remap all references, retain IDs
where possible, and execute in foreign-key-safe order in one transaction.
Any failure rolls back everything. Return created, updated, unchanged/skipped,
and removed counts per section, including cached items and joins where useful.

### 5. Download the receiver backup before committing Replace

Use a prepare/commit flow so backup download precedes mutation:

1. On the final Import action, pause and drain Settings autosaves, then call
   `POST /api/transfer/prepare` with the document, mode, and exact visible
   selection. Revalidate against current receiver state.
2. Store a short-lived, bounded, immutable prepared operation behind an opaque
   token. For Replace, capture the full receiver export and a canonical
   fingerprint of all receiver data from the same read snapshot. Return the
   token, backup document, and filename. Preparing changes no app data.
   Merge uses the same flow without a backup.
3. The browser creates a JSON Blob and automatically initiates its download
   using `knowbook-backup-...json`. Only after that succeeds call
   `POST /api/transfer/commit` with the token. A backup creation, response,
   or download-initiation failure must prevent commit.
4. Commit acquires the SQLite write transaction before comparing the receiver
   fingerprint. Include all persisted data and stored dates, but exclude
   envelope generation time. If another tab, autosave, or feed refresh changed
   the receiver, reject without writes and require a fresh prepare and backup
   download. Never hold a transaction open during browser download.
5. Apply the immutable prepared operation atomically. Prevent concurrent token
   execution and retain successful results for the token's lifetime, so retries
   after a lost response cannot apply Replace again. Expired tokens or server
   restart require preparing again. Clean up pending data on expiry.

The backup contains the **receiving instance's pre-replace state**, including
unchecked sections, never a copy of the uploaded file. The server requires a
prepared Replace operation and rejects changes to its file or selections.
It can enforce backup preparation; browser code enforces download ordering.

Browsers cannot reliably confirm that a user finished saving a download. The
guarantee is successful backup generation and download initiation before
commit, not verified disk persistence. Failed commits leave the downloaded
backup available for recovery.

### 6. Add the Settings UI and refresh client state

Add an Export & import card to `app/pages/settings.vue`, with Export and Import
actions. Put the dialog in `app/components/settings/ImportDialog.vue` and
coordinate preview, prepare, download, commit, and errors in
`app/composables/useDataTransfer.ts`.

Export immediately downloads the full file. Import opens a picker and shows
metadata, counts, six initially checked boxes, and radios labelled **Merge**
and **Replace**, defaulting to Merge. Explain disabled/locked options and that
Replace automatically downloads a local backup first. The final action names
the mode and visible selected sections. Selecting the radio alone must not
start a download.

Reset preview/prepared tokens on file, mode, or selection changes, and ignore
stale responses. Prevent duplicate submission. Show validation, backup, and
import progress, useful errors, and a completion summary with the backup
filename where applicable.

The current Settings page debounces full-form PATCH requests: cancel/drain
pending saves before preparation, suppress the draft watcher while hydrating
imported settings, and release the UI pause on success or failure. Refetch
`/api/settings`; update `useState('app-settings')` and the draft together so the
existing theme binding applies immediately. Reset affected Pinia stores
(sources, subfeeds, feeds, bookmarks, tags, cached item views/searches) and
invalidate relevant Nuxt fetch caches. Old in-flight responses and autosaves
must not overwrite imported state.

## Implementation order

1. Shared format, complete exporter, and round-trip fixtures.
2. Validation, identity mapping, dependency planner, and preview endpoint.
3. Transactional Merge/Replace, including partial-selection cases.
4. Prepare/commit, receiver backup, concurrency and retry handling.
5. Settings UI, downloads, autosave coordination, and cache invalidation.
6. Focused tests, browser verification, and normal repository checks.

## Testing

- Export/schema tests cover every table/field, cached unbookmarked articles,
  unattached tags, all joins, managed snapshots, inline tags, nullable dates,
  raw settings, empty sections, and both filename patterns with a fixed clock.
- In-memory DB tests using `tests/db/helpers.ts` cover full round trips with
  different destination IDs, exact date/order/content restoration, malformed
  references, unsupported versions, ambiguous identities, and no origin fetch.
- Test Merge idempotency, imported-value precedence, relationship unions,
  destination-only data, bookmark order, and empty sections in both modes.
- Test prerequisites and transitive Replace restrictions, especially Sources
  with Bookmarks/Feeds/Subfeeds unchecked and Tags with Sources unchecked.
  Valid partial replacements preserve all unchecked data; invalid direct API
  selections fail before writes. Include Settings-only replacement.
- Test transaction rollback after a mid-write failure, config ownership,
  managed-to-ordinary restoration, conflicts, and raw setting preservation.
- API tests verify preview/prepare without writes, full receiver backup rather
  than upload data, stale fingerprints after autosave/refresh, expired tokens,
  duplicate commits, and retry after a lost successful response.
- UI/composable tests verify initial selections and Merge default, checkbox
  disabling/locking and explanations, mode/file/selection changes, size/errors,
  download before commit, no commit after backup failure, progress/summary,
  autosave races, immediate settings/theme update, and cache invalidation.
- Manually verify downloads and checkbox behavior in a browser, then run
  `pnpm test`, `pnpm lint`, and `pnpm build` during implementation. Use fixtures,
  mocks, and an injected clock; no live feeds or real-time delays are needed.

## Acceptance criteria

- Settings offers Export and Import. Export contains all persisted app data in
  versioned JSON named with Knowbook and an ISO timestamp.
- Import offers Sources, Subfeeds, Feeds, Bookmarks, Tags, and Settings, all
  initially checked, plus Merge/Replace radios with Merge initially selected.
- Dependency restrictions are explained in the dialog and enforced by the
  server. No selection silently loses links or deletes unchecked data.
- Merge is deterministic and repeatable. Replace affects only the final
  visible selected sections, with documented config-ownership restrictions.
- Replace automatically downloads a complete receiver-side backup with
  `backup` and an ISO timestamp before committing. Backup failures leave app
  data untouched; concurrent changes require a fresh backup.
- Commit retries do not repeat imports. Invalid documents or failed writes
  leave no partial changes, and IDs/relationships are correctly remapped.
- Full restoration preserves cached content, dates, bookmark order/tags,
  memberships, and settings. Managed snapshots cannot grant config ownership.
- Completion shows a summary, applies settings/theme, and refreshes client
  data without stale store values or autosave regressions.

## Out of scope

- Scheduled backups, cloud storage, and third-party formats such as OPML.
- Transferring deployment files, environment variables, managed-source config
  files, executable plugins, or files behind hotlinked image URLs.
- Introducing data/settings for unfinished features; extend the versioned
  format as those features land.
