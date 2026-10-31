---
id: "17"
title: Responsive layouts across the application
description: >-
  Make Knowbook usable on phones, tablets, and desktops by adapting navigation,
  reading layouts, forms, tables, and actions to the available width without
  losing access to content or controls.
status: todo
dependencies: ["03", "05", "06", "07", "08", "11"]
affects: [app, tests]
---

# 17 — Responsive layouts across the application

> Part of the [implementation plan](../00-plan.md). See the
> [issue index](../01-issues.md) for ordering and dependencies.

## Goal

Make the existing website comfortable to read and operate from a narrow phone
through a wide desktop. Responsiveness has been reported as inadequate; audit
the rendered application, record reproducible failures, and fix the shared
layout and affected pages. Existing grid/editorial breakpoints are a starting
point, but do not establish that navigation, controls, or their content fit.
Preserve every existing workflow and the user's saved layout preferences.

**Depends on:** 03 (source management), 05 (subfeeds), 06 (composed feeds),
07 (shared content views), 08 (bookmarks), and 11 (settings & theming).
Cover the existing homepage too; the future homepage design (13) and
internationalization (16) do not block this work.

## Tasks

### 1. Audit real pages and establish shared layout rules

Inspect navigation, homepage, source list/create/edit/items/subfeeds, feed
list/detail and membership forms, subfeed reading, bookmarks, Organise, and
Settings. Include dialogs, dropdowns, validation messages, loading, empty, and
error states. Record the route, viewport, triggering content, and screenshot
for failures before fixing them.

Review `app/layouts/default.vue`, `app/assets/css/main.css`, and shared
components first. Use mobile-first styles and consistent existing Tailwind
breakpoints, with content determining when a row needs to wrap or stack.
Keep page gutters and readable desktop widths. Allow flex/grid children to
shrink, wrap long titles/URLs/tags, and bound images and inputs to their
containers. Do not conceal layout failures with global horizontal clipping.
Prefer CSS-driven adaptation so SSR and hydration render consistently.

### 2. Adapt navigation and page actions

The default layout currently places all six navigation links in one horizontal
menu. Provide an accessible compact menu when those links no longer fit,
retaining direct navigation to every destination and the active-page state.
Support keyboard operation, an accessible toggle name and expanded state,
Escape to close, focus return to the toggle, and closing on navigation.

Stack or wrap headings and action groups on narrow screens, including long
source/feed names. Keep create, edit, delete, refresh, and back actions visible
and reachable. Avoid essential actions that require hover. Give primary touch
controls at least a 44 by 44 CSS-pixel hit area with adequate separation.

### 3. Reflow reading surfaces and controls

Audit `ItemViewToolbar.vue`, `ItemPager.vue`, `ItemCard.vue`, `ItemList.vue`,
and the bookmark components. Search, tag/source filters, sort, page size,
layout selection, refresh, pagination, bookmark actions, and tag editing must
fit without overlapping or pushing the document sideways. Use full-width or
stacked fields on small screens and compact rows where space allows; keep
selected values and long labels usable.

Retain list, grid, and editorial choices. Use one readable column on narrow
screens, increasing columns only when the available space supports them;
preserve editorial ordering and configured desktop column ratios. Resizing
must not reset the route/query, filters, page, or saved layout preference.

The source items page currently uses fixed `w-80` columns inside a horizontal
scroller for **By subfeed**. On phones, stack those sections vertically with
their headings and all items accessible. Retain side-by-side columns on wider
screens; any horizontal scrolling must stay within that explicitly labelled
region, with each column bounded by the available width. Preserve existing
single-column card rendering within each subfeed.

Keep bookmark reordering usable with touch without preventing normal vertical
scrolling, and retain the existing move actions as an alternative to dragging.

### 4. Adapt management views, forms, and overlays

Review source/feed tables and grouped lists, Organise rows, source/subfeed/feed
forms, member selection, `QueryParamsEditor.vue`,
`sources/PaginationParamsEditor.vue`, and Settings. Stack paired fields and
key/value/action rows when needed. Keep labels, help text, validation errors,
and save/cancel controls inside the viewport, including with long values.

Use stacked records or an explicitly bounded horizontal table scroller where
tabular comparison requires it. Every row action must remain reachable, and
scrolling a table must not widen the page. Size dialogs to the viewport with
internal vertical scrolling when needed; keep dropdowns/select menus on screen
and focused fields reachable when the mobile keyboard is open.

## Testing

- Verify in a real browser at widths of 320, 375, 390, 768, 1024, and 1440 CSS
  pixels, plus immediately around any changed breakpoint. Include phone
  landscape, a short viewport, and desktop browser zoom at 200%.
- Use deterministic local fixtures with long unbroken titles and URLs, many
  tags, long labels, images present/absent, multiple subfeeds, and enough table
  rows to exercise scrolling. Do not depend on live RSS feeds.
- Add focused browser regression coverage for the compact navigation,
  document-level horizontal overflow, narrow reading toolbar/cards, subfeed
  stacking, and a representative management form/table/dialog. Use browser
  layout measurements and interactions; DOM-only unit tests cannot prove fit.
- Check keyboard navigation and focus, touch-sized controls, menu dismissal,
  bookmark reordering, and state preservation while resizing. Manually verify
  a touch browser with its on-screen keyboard and capture phone/tablet/desktop
  screenshots in both themes. Check longer translated labels if issue 16 has
  landed by implementation time.
- Run the existing lint, test, and build checks after implementation.

## Acceptance criteria

- All existing routes and workflows remain usable at the listed viewport
  widths, with readable content and no overlapping or inaccessible controls.
- The document has no horizontal overflow at 320 CSS pixels or wider; any
  necessary wide table/subfeed scrolling is contained in its own region.
- Every navigation destination is available on phones through a keyboard- and
  touch-operable compact menu with correct focus handling.
- Reading layouts adapt to available space; phone subfeed sections stack, and
  resizing preserves query state and saved layout preferences.
- Forms, validation, tables, dialogs, menus, pagination, and bookmark actions
  remain usable with long content, touch input, and browser zoom.
- Browser regression checks and representative screenshots demonstrate the
  fixes in both themes, with no SSR hydration warnings caused by adaptation.

## Out of scope

- A visual rebrand, new homepage content (13), or new reading modes.
- Changes to feed fetching, API contracts, database schemas, or persisted
  settings solely to accommodate viewport size.
- Native mobile apps, offline/PWA support, and responsive email digests (14).
- Implementing translations (16); allow existing labels to grow and wrap.
