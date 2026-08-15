---
id: 07b
title: Tag include/exclude filtering
description: >-
  Extend the item views' tag filter from include-only to include *and* exclude,
  so a tag can be muted (e.g. hide "Sport") rather than only selected for.
status: todo
dependencies: ["07"]
affects: [app, server, tests]
---

# 07b — Tag include/exclude filtering

> Part of the [implementation plan](../00-plan.md). See the
> [issue index](../01-issues.md) for ordering and dependencies.

## Goal

Issue 07's tag filter is include-only with AND semantics: an item must carry
every selected tag. For a reader, the inverse is arguably the more common need —
"show me everything except Sport" — and it cannot be expressed today. This issue
adds exclusion alongside inclusion.

**Depends on:** 07 (shared content views).

Split out rather than folded into 07's follow-up fixes because it is the one
item from that round that changes the **query contract** rather than presentation:
the schema field, the URL format, the view-layer predicate and the toolbar
control all move together. Everything else in that round was a fix behind an
unchanged contract. (The `b` suffix follows the precedent set by
[04b](./04b-simplify-classification.md).)

## Tasks

### 1. Query contract

`shared/schemas/itemQuery.ts` currently has a single `tags` array. Decide between:

- **`tags` + `excludeTags`** — two arrays, both reusing the existing
  repeated-or-comma-separated `toStringArray` preprocessor. Backwards compatible:
  an existing `?tags=a,b` URL keeps working untouched.
- A single signed field (`tags=a,-b`) — one param, but it overloads a value that
  can legitimately contain a leading `-`, and every consumer has to parse it.

Prefer the two-array form for exactly that compatibility reason: issue 07 made
filtered views linkable, so old links must not break.

### 2. View layer

`server/feed/view.ts#applyItemView` gains a second predicate beside the existing
AND include filter. Semantics to write down and test:

- Exclude wins over include when a tag appears in both — an explicit "hide this"
  is the more specific instruction.
- Exclusion is OR across the excluded set: an item carrying *any* excluded tag is
  dropped. (Contrast with include, which is AND.) That asymmetry is deliberate and
  matches how muting reads in practice, so it needs a comment — it is exactly the
  kind of thing a later reader would "fix" into symmetry.
- An untagged item is never excluded.

Facets stay derived from the pre-filter set (issue 07's rule), so excluding a tag
must not remove it from the select — otherwise it could never be un-excluded.

### 3. URL sync and toolbar

- `app/composables/useItemView.ts#syncUrl` writes the second array, and
  `parseQuery` picks it up.
- `app/components/items/ItemViewToolbar.vue` needs a control expressing three
  states per tag (ignored / included / excluded) rather than a binary
  multi-select. Options: two `USelectMenu`s (simplest, most verbose on screen), or
  one menu whose items cycle include → exclude → off with a leading +/− marker
  (compact, needs a custom item slot). Decide when building the UI; the second is
  nicer but only if the affordance reads unambiguously.

## Testing

- `tests/feed/view.spec.ts`: an excluded tag drops matching items; exclude beats
  include on a tag in both; exclusion is OR across the set while inclusion stays
  AND; untagged items survive exclusion; facets still list an excluded tag.
- `tests/api/items.spec.ts`: the new param parses in both repeated and
  comma-separated form; an existing `?tags=` URL behaves exactly as before.
- `tests/nuxt/ItemViewToolbar.spec.ts`: the control emits the expected patches for
  each of the three per-tag states.

## Acceptance criteria

- A tag can be included, excluded, or ignored, on all three view kinds.
- Exclusion is expressible in the URL and survives a reload, and URLs written
  before this issue continue to work unchanged.
- Excluding a tag does not remove it from the tag select.
- Typed end-to-end with no `any` leaks; `pnpm test`, `pnpm lint` and `pnpm build`
  pass.

## Out of scope

- Include/exclude for the **source** filter on a feed view — same idea, but wait
  until it is actually wanted rather than doubling the UI on spec.
- Saved filter presets, and per-source default mutes: those belong with settings
  (issue 11) or a later curation issue.
- Full-text negation in the search box (`-word`). Search stays a plain
  case-insensitive substring match over title and description.
