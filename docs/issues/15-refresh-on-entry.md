---
id: "15"
title: Automatic refresh on entry
description: >-
  Refresh a source, subfeed, or composed feed when entering its item view if
  the time since the previous visit meets a user-defined threshold (default
  one hour), persisting the setting and each target's last visit timestamp.
status: done
dependencies: ["05", "06", "07", "11"]
affects: [app, server, db, tests]
---

# 15 — Automatic refresh on entry

> Part of the [implementation plan](../00-plan.md). See the
> [issue index](../01-issues.md) for ordering and dependencies.

## Goal

Opening a reading view should bring in new items after an absence without
requiring a click on Refresh. Track when each source, subfeed, and composed feed
was last entered, and automatically refresh it when the time since the previous
visit reaches the user's saved threshold. Default to **one hour**, with an
inclusive range of **one minute to 24 hours**. Keep cached items readable while
the refresh runs.

**Depends on:** 05 (subfeeds), 06 (composed feeds), 07 (shared content views),
and 11 (settings & theming). Reuse their refresh engine, routes, stores, shared
item view lifecycle, and persisted settings infrastructure.

## Tasks

### 1. Add a persisted refresh threshold setting

Extend the shared settings schema, defaults, API/helpers, and Settings page with
an app-wide `autoRefreshThresholdMinutes` setting. Accept integer minutes from
**1 to 1440 inclusive**, defaulting to **60**. Reject invalid API updates without
changing storage; missing, malformed, or out-of-range stored values fall back
to 60 minutes.

Provide presets **1m, 5m, 10m, 30m, 1h, 3h, 6h, 12h, 24h**, plus a way to
enter any whole-minute value within the range. Label the control as the time
since the last visit required for automatic refresh, rather than a polling
frequency. Save through the existing settings API and read the effective value
on each entry so changes apply on the next visit without a restart. Changing
the setting does not itself refresh an open view or reset visit timestamps.

### 2. Persist last visits and apply the threshold

Add a nullable `lastVisitedAt` timestamp to sources, subfeeds, and feeds through
a database migration, repository changes, and shared types. Use the existing
epoch-millisecond timestamp convention. Existing records begin with no visit;
opening one for the first time is eligible for automatic refresh.

On each entry, read the **previous** timestamp, decide whether refresh is due,
then persist the current visit time even when no refresh is needed:

- No previous visit: refresh.
- `now - previousLastVisitedAt >= autoRefreshThresholdMinutes * 60_000`:
  refresh, including exactly the configured threshold.
- Less than the threshold: use cached items without an automatic origin fetch.

This measures time since the last **visit**, not the last successful refresh or
an item's publication/fetch time. With the default one-hour setting, visits at
10:00, 10:40, and 11:10 do not refresh at 11:10; the previous visit was only 30
minutes earlier. Staying on a page beyond the threshold does not trigger another
refresh. A manual refresh does not change the recorded visit time.

Keep visit metadata server-owned, outside source/feed edit forms and managed
source configuration. Use server time and an atomic read/check/update so two
concurrent entries cannot both claim the same overdue visit. Unknown targets
return 404 without creating visit state. A future stored timestamp must not
prevent refresh indefinitely: treat it as invalid and replace it on entry.

### 3. Register entry through a shared flow

Provide a typed server operation for recording a target visit and performing
the refresh when due. Keep normal item GET requests cache-only: fetching,
filtering, sorting, paging, and search must not implicitly record visits.
Reuse `refreshSource`, `refreshSubfeed`, and `refreshFeed` with their normal
refresh limits; do not introduce a separate fetch/parse/cache path.

Wire entry handling through `app/composables/useItemView.ts` and the source,
subfeed, and feed reading pages. Count initial browser entry, reload, and
navigation back to a target as visits. Query-only changes (filters, search,
sort, page, layout) are not new entries. Handle navigation between different
IDs even when Nuxt reuses the page component.

Run the visit operation once after client entry; SSR, hydration, and background
prefetch must not each register it. Continue to render cached items through
the existing SSR load. Only enter targets whose items are being read: listing
sources, editing configuration, or listing subfeeds does not count. In the
source's side-by-side subfeed view, apply the same policy to each displayed
subfeed once; avoid also scheduling a duplicate refresh for a hidden source
stream. Bookmarks have no remote refresh target and remain cache-only.

### 4. Share pending, reload, and failure behaviour

Use the existing refreshing state and refresh controls for automatic and manual
refresh. Coalesce overlapping refreshes of the same target so entry hooks or a
manual click during automatic refresh do not start duplicate work. A composed
feed refresh follows its existing member semantics; it does not mark its
members as visited merely because their items were fetched.

After refresh, reload the current cached view, including any displayed subfeed
columns, preserving filters, search, sort, page, and layout. Do not replace
cached items with a blocking loading screen. Report refresh failures using the
existing error conventions and retain usable cached content, including items
cached before a partial failure.

The visit timestamp records entry even if the origin refresh fails. Do not
retry automatically on every render or immediate re-entry; manual Refresh
remains available regardless of the configured threshold. If recording the visit
itself fails, retain cached content and expose the error without a retry loop.

## Testing

- Settings/API tests cover the 60-minute default, persistence, all listed
  presets, custom whole-minute values, inclusive bounds of 1 and 1440, rejection
  of invalid updates, and safe fallback for invalid stored values.
- Use a fixed/injected clock to cover first entry, just below, exactly at, and
  above the configured threshold, including the one-minute and 24-hour bounds,
  and an invalid future timestamp.
- Verify changing the setting affects the next entry without resetting visit
  timestamps or immediately refreshing the open page.
- Repository/API tests cover persistence, independent state for different
  kinds/IDs, sequential visits that reset the interval, concurrent entries,
  unknown targets, and timestamp recording when origin refresh fails.
- Mock the refresh engine to verify each target uses the existing refresh
  path and that composed-feed refresh does not mark members visited.
- Store/composable/page tests cover one entry across SSR/hydration, reload and
  back navigation, reused page IDs, no entry on query changes, side-by-side
  subfeeds, and overlap with manual refresh.
- Verify cached items remain visible on failure and refreshed results preserve
  the current query/layout. All tests use fixtures or mocks, with no live feeds
  or real-time waits.

## Acceptance criteria

- Entering a source, subfeed, or composed-feed item view refreshes automatically
  on first visit or when time since its previous visit reaches the saved
  threshold, including equality.
- Settings exposes a persisted app-wide threshold defaulting to one hour, with
  presets 1m, 5m, 10m, 30m, 1h, 3h, 6h, 12h, and 24h, and custom whole-minute
  values from 1 minute through 24 hours inclusive.
- Invalid threshold updates are rejected; missing or invalid stored values use
  the one-hour default. A saved change applies on the next entry.
- Each entry persists its timestamp, including entries that skip refresh;
  state survives a browser reload and server restart.
- Visits are independent per target; refreshing a member indirectly does not
  count as entering it.
- SSR/hydration, query changes, and overlapping refresh requests do not cause
  duplicate automatic work for the same entry/target.
- Cached content remains readable during refresh and after failures, and manual
  Refresh remains available without waiting for the configured threshold.

## Out of scope

- Scheduled polling, background jobs, tab-focus refresh, and periodic refresh
  while a page remains open.
- Per-target refresh preferences; the threshold is one app-wide user setting.
- Per-item read/unread state or a homepage-wide last-visit indicator (issue 13).
- Changing origin pagination, search-until-found, or composed-feed membership
  semantics.
