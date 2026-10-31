---
id: "11"
title: Settings & theming
description: >-
  Add a settings page for persisted app defaults and appearance, including view
  page size, search depth, light/dark theme preference, and the editorial
  layout's column ratio.
status: done
dependencies: ["00", "07"]
affects: [app, server, tests]
---

# 11 — Settings & theming

> Part of the [implementation plan](../00-plan.md). See the
> [issue index](../01-issues.md) for ordering and dependencies.

## Goal

Make the settings table useful to the user: expose the defaults already read by
the server, persist appearance preference, and let readers tune the editorial
layout. Settings remain key/value records in the existing database, with
validated defaults so an unset or invalid value never breaks a view.

**Depends on:** 00 (project scaffolding) and 07 (shared content views) — both
done. Issue 07 introduced list, grid and editorial modes; this issue owns the
default page size, search-until-found cap, theme preference, and editorial
column ratio.

## Tasks

### 1. Define setting keys, defaults, and validation

Centralise the supported setting keys and their defaults in the shared/server
settings layer. Keep the existing keys `pageSize` and `searchMaxPages` in sync
with `server/utils/settings.ts` and the values already consumed by item and
search routes. Add keys for `theme` (`light` or `dark`) and
`editorialColumnRatio` (three positive column weights, for example
`[25, 50, 25]`).

Validate each setting at the API boundary and when reading stored values. Use
safe defaults for missing, malformed, or out-of-range stored data. Keep page
size within the same 1–200 range as `itemQuerySchema`; require positive integer
search page caps; constrain editorial weights to a documented range and
normalize them to proportions when rendering. The current defaults are page
size 25, the feed engine's `DEFAULT_MAX_PAGES`, light theme, and equal editorial
columns.

### 2. Settings API and persistence

Add typed endpoints to read the supported settings and update them. Accept only
known keys and values that pass their schemas; clients must not write arbitrary
settings or internal records. Reuse the settings repository's key/value
operations and return the effective settings, including defaults, so the UI
does not need to reproduce fallback rules.

Add server helpers for `editorialColumnRatio` alongside the existing
`pageSizeSetting()` and `searchMaxPagesSetting()`. Keep search routes and view
routes reading the same helpers, so a changed setting takes effect without a
restart.

### 3. Settings page

Add a reachable Settings page and a navigation entry. Provide controls for:

- Default item page size.
- Maximum pages fetched by search-until-found when the request does not
  override it.
- Light or dark appearance.
- Editorial layout column ratio, using a small set of understandable presets
  such as equal thirds and a wider middle column.

Save changes through the settings API, show validation and save failures using
existing form conventions, and reflect the saved values immediately. State
clearly which options have an effect only when a query does not provide its own
page size or search cap.

### 4. Apply theme consistently

Use Nuxt UI's color mode support to apply the persisted light/dark choice across
SSR and client navigation without a flash or hydration mismatch. Set the
project's light palette to the planned beige background and the dark palette
to dark brown, while preserving readable text, borders, focus indicators, and
component states. The saved preference should be available on the initial
render; do not depend on a client-only setting fetch to choose the first theme.

### 5. Apply editorial column ratio

Update the editorial item layout to use the persisted three-column ratio at
wide breakpoints, with sensible two-column and single-column responsive
behaviour at narrower widths. Keep the existing editorial card presentation
and image handling; only the available column widths and layout tracks change.
The ratio must be applied consistently to source, subfeed, composed-feed, and
bookmark item views.

## Testing

- Unit-test setting schemas and helpers for defaults, valid bounds, malformed
  stored values, and ratio normalization.
- API tests cover reading effective defaults, saving each supported setting,
  and rejecting unknown keys or invalid values without changing storage.
- View/layout tests cover the persisted ratio across the item view consumers
  and responsive fallbacks; theme tests cover setting application on first
  render and after client-side changes.
- Use an in-memory database or repository mocks; no external services are
  needed.

## Acceptance criteria

- A user can open Settings and change page size, search cap, theme, and
  editorial column ratio; values persist across reloads.
- Views use the saved page size and search cap only when the request does not
  explicitly supply those values.
- Missing, malformed, or invalid stored settings fall back safely to the
  documented defaults.
- Light and dark themes apply across the app, including the planned beige and
  dark brown palettes, without a visible theme flash during initial render.
- Editorial views use the chosen ratio on wide screens and remain readable on
  smaller screens across sources, subfeeds, feeds, and bookmarks.
- The API only accepts supported settings and rejects invalid values.

## Out of scope

- Per-source pagination and query parameters; those remain part of source
  configuration.
- User-defined color palettes or arbitrary theme CSS.
- Configuring the editorial ratio per feed or per page; this is one app-wide
  default.
- Digest schedules, recipients, and delivery settings; those belong to issue
  14.
