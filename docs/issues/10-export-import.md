---
id: "10"
title: Export & import
description: >-
  Export a portable, versioned backup of user-owned sources, subfeeds, feeds,
  bookmarks, and settings, and restore it with explicit merge or replace
  behaviour so configuration and saved reading can move between Knowbook
  instances.
status: todo
dependencies: ["03", "06", "08"]
affects: [app, server, tests]
---

# 10 — Export & import

> Part of the [implementation plan](../00-plan.md). See the
> [issue index](../01-issues.md) for ordering and dependencies.

## Goal

Give the user a portable backup they can download and later restore. The
document covers user-managed source configuration and tags, subfeeds, composed
feeds and their memberships, bookmarks with enough item data to survive a move
to another database, and settings. Import validates the whole document before
writing and offers merge and replace modes with predictable conflict handling.

**Depends on:** 03 (source management), 06 (composed feeds), and 08
(bookmarks) — all done. The export format should preserve the current domain
model while remaining versioned so a future format change can be migrated.

## Tasks

### 1. Define a portable backup format

Add a shared, versioned JSON contract (for example, `format: 'knowbook-backup'`
and `version: 1`) with strict validation for the top-level structure and
individual records. Export user-owned sources and their tags/subfeeds, feeds
and source-or-subfeed memberships, bookmarks and their tags/manual order, and
all settings. Preserve configuration fields such as source pagination and
query parameters.

Bookmarks refer to cached items, which may not exist in a fresh database. Store
the bookmarked item's portable fields and its source identity in the backup;
do not export the entire fetched-item cache. This lets import restore saved
bookmarks and their visible content without turning a backup into a full feed
archive. Use stable natural references in the file (such as source URL and item
GUID) rather than relying on database-generated ids.

Managed sources are maintained by the application config loader (issue 09), so
the backup must not claim ownership of them. Exclude managed source definitions
from export; imported feed memberships may resolve to a managed source already
present in the destination by URL. Never overwrite or delete managed source
configuration during import.

### 2. Export endpoint and download flow

Add a server endpoint that gathers the related records and returns a validated
backup document with a suitable JSON download filename. Keep database ids out
of the portable identity contract; timestamps may be retained where they are
meaningful (for example bookmark creation time), but import must not depend on
them for uniqueness.

Add an Export & import section in settings with a download action. Surface
request failures through the app's existing error messaging conventions.

### 3. Validate and preview import

Parse uploaded JSON on the server against the shared format/version schema.
Reject malformed documents, unsupported versions, invalid references, and
duplicate conflicting records before changing the database. Return a clear
validation error that identifies the affected section/record where practical.

Provide a preview of the records and mode the user is about to import, including
counts for sources, subfeeds, feeds, bookmarks, and settings. Do not echo
secrets or arbitrary setting values into logs.

### 4. Define and implement merge and replace semantics

Both modes run as a database transaction after validation. Merge preserves
existing records and is repeatable: match sources by URL, subfeeds by parent
source plus name, feeds by name, bookmarks by source URL plus item GUID, and
settings by key. Update matching user-owned configuration from the import,
create missing records, and avoid duplicate tags, memberships, or bookmarks.
Resolve memberships and bookmark references through the newly mapped ids.

Replace replaces the restorable user-owned data represented by the backup,
including settings, user-managed sources and their subfeeds, composed feeds,
and bookmarks. Preserve managed sources and their config-owned state. Import
the document's records after clearing eligible user-owned records, in FK-safe
order and inside the same transaction, so any failure leaves the database as
it was before the import.

Return an import summary with created, updated, skipped, and removed counts by
section. Make the replace action explicit in the UI and require a final
confirmation that names the data it will replace.

### 5. Import UI and store

Add file selection, preview, merge/replace choice, and completion summary to
the settings page. Validate file type and size client-side for usability, but
keep server validation authoritative. Reset the file input and preview when a
new file is selected, and prevent submission while validation or import is in
progress.

### 6. Keep the format maintainable

Keep format parsing/mapping separate from route handlers and database
repositories. Add an explicit version dispatch point so a later format version
can be migrated into the current internal representation before import; an
unknown version must fail clearly rather than being partially accepted.

## Testing

- Unit-test backup schema validation, supported-version dispatch, stable
  identity mapping, and rejection of malformed references or duplicate
  conflicting records.
- Repository/route tests with an in-memory database cover exporting related
  records, merge idempotency, updates to matching user-owned records,
  referential remapping, bookmark restoration from its item snapshot, and
  transaction rollback on a write failure.
- Verify replace removes user-owned data while preserving managed sources and
  their subfeeds, and that omitted or explicit settings are handled according
  to the backup document.
- Component/store tests cover file selection, preview, mode selection,
  confirmation, loading/error states, and displaying the import summary.
- Keep fixtures deterministic and avoid network access; no live feed refresh is
  required to export or import.

## Acceptance criteria

- A user can download a valid, versioned JSON backup containing user-owned
  source configuration and tags, subfeeds, composed feeds and memberships,
  bookmarks with portable item data and manual order, and settings.
- A backup can be validated and previewed before any database writes occur.
- Merge imports are repeatable and update or create records without duplicate
  sources, subfeeds, feeds, memberships, tags, or bookmarks.
- Replace restores the backup's user-owned data atomically and preserves
  managed sources and config-owned state.
- Imported references use destination database ids correctly, including
  bookmarks whose cached items were absent before import.
- The UI presents a completion summary and requires explicit confirmation for
  replace mode.
- Unsupported backup versions and invalid documents produce actionable errors
  and do not leave partial changes.

## Out of scope

- Exporting the full cached item history; only bookmarked item snapshots are
  included to make bookmarks portable.
- Migrating/importing managed-source definitions, which remain owned by the
  application config loader (issue 09).
- Scheduled backups or cloud storage; this issue is a user-triggered local file
  download/upload flow.
- Exporting digest subscription settings or delivery credentials; email digests
  are described separately in issue 14.
