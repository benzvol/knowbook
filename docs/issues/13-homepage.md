---
id: "13"
title: Homepage
description: >-
  Give the homepage a purpose. It is currently a title and a tagline, so the
  first thing the app shows says nothing about what is in it.
status: todo
dependencies: ["07", "08"]
affects: [app, server, tests]
---

# 13 — Homepage

> Part of the [implementation plan](../00-plan.md). See the
> [issue index](../01-issues.md) for ordering and dependencies.

## Goal

`app/pages/index.vue` is a placeholder: an icon, "Knowbook", and "A single-user
RSS reader." Every route worth visiting is reached through the nav menu, so the
landing page is dead space.

**Placeholder issue — no design decided yet.** Captured so it is not forgotten;
what the homepage should actually be is the first thing to settle when it is
picked up.

**Depends on:** 07 (shared content views) and 08 (bookmarks) — whichever
direction is chosen, the homepage will almost certainly reuse their components
rather than introduce a fourth way to render items.

## Open questions to settle first

Roughly in order of how much they change the answer:

- **Is it a dashboard or a reading surface?** A dashboard (counts, what is stale,
  quick links) is cheap and honest. A reading surface ("everything new across all
  feeds") is more useful day to day but raises the question below.
- **Is "all items across every source" a real view?** The engine has no such
  target today — `applyItemView` is always given one source's, one subfeed's or
  one feed's items. Adding an all-items view means a new repository read and a
  fourth view kind, which is a genuine feature, not a homepage tweak. A cheaper
  approximation is to let the user nominate a default feed and render that.
- **What is actually worth surfacing?** Candidates: newest items since last
  visit, sources whose newest item is oldest (i.e. stale or broken), recent
  bookmarks, per-source item counts.
- **Does it need a "last visited" timestamp?** Anything phrased as "new since you
  were here" needs one persisted in `settings`, and read/unread state is
  explicitly out of scope for issue 07 — so that decision has consequences
  beyond this page.

## Acceptance criteria

To be written once the direction is chosen. At minimum: the homepage tells the
user something they would otherwise have to navigate to find, and it reuses the
existing item components rather than re-implementing item rendering.

## Out of scope

- Read/unread state, unless the chosen direction genuinely requires it — issue 07
  deferred it deliberately.
- Configurable homepage widgets or layout. Pick one useful default first.
