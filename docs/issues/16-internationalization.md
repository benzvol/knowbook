---
id: "16"
title: English/Hungarian internationalization & localized dates
description: >-
  Translate the application interface into English and Hungarian with a
  persisted language preference, and format displayed dates and times using
  the selected locale consistently across SSR and client navigation.
status: todo
dependencies: ["07", "08", "11"]
affects: [app, server, tests, config]
---

# 16 — English/Hungarian internationalization & localized dates

> Part of the [implementation plan](../00-plan.md). See the
> [issue index](../01-issues.md) for ordering and dependencies.

## Goal

Let the user read and operate Knowbook in English or Hungarian, with dates and
times following the same language choice. Replace hard-coded interface text
and the `en-US` date formatting in `app/components/items/ItemCard.vue` with a
shared localization layer. Persist the choice through the existing settings
system and apply it on the first server render as well as client navigation.

**Depends on:** 07 (shared content views), 08 (bookmarks), and 11 (settings &
theming). This extends the settings contract and covers the existing interface,
including shared cards used by bookmark views.

## Tasks

### 1. Locale setup and message catalogs

Introduce an SSR-compatible Nuxt/Vue i18n integration with supported language
codes `en` and `hu`, mapped to formatting locales `en-US` and `hu-HU`. Keep
English as the default and fallback for missing translations. Maintain parallel
message catalogs with stable semantic keys, interpolation, and pluralization
for counts; avoid concatenating translated sentence fragments.

Use one locale source for application messages and Nuxt UI component messages
(pagination, selects, and other built-in controls). Set the document's `lang`
attribute to the active language. Keep existing routes and shared links intact;
language selection does not require locale-prefixed URLs.

### 2. Persist and expose the language preference

Extend `shared/schemas/settings.ts`, the settings API/helpers, and the Settings
page with a `locale` setting accepting only `en` or `hu`. Offer the choices as
**English** and **Magyar** so the selector remains recognizable in either
language. Missing or unsupported stored values fall back to English; invalid
API updates are rejected without changing the saved preference.

Resolve the saved setting before SSR and hydrate the client with that same
locale, following the existing settings bootstrap pattern. Switching language
updates the visible interface and dates immediately and persists across reloads
and server restarts. Preserve the current route, item query, layout, and form
values while switching. Do not use browser language detection to override an
explicit choice.

### 3. Translate the existing interface

Move application-owned user-facing strings into the catalogs across navigation,
homepage, source/subfeed/feed lists and forms, organisation/tag management,
shared item views, bookmarks, and Settings. Include headings, actions, menus,
field labels and help text, placeholders, empty/loading/error states, dialogs,
toasts, tooltips, accessible names, and application-owned page titles.

Translate dynamic refresh summaries, result counts, validation messages, and
search-cap notices with interpolation/plural rules. Give known application
errors stable codes/keys or map their structured validation details to localized
messages; keep a localized generic fallback for unknown failures. Avoid
language-specific business logic or storing translated messages in the database.

Keep source/feed/subfeed names, tag names, article titles and descriptions, URLs,
and technical configuration values as supplied. Feed content is not machine
translated, and changing language must not rewrite user data or API field names.

### 4. Centralize localized date/time formatting

Replace the hard-coded `toLocaleDateString('en-US', ...)` in `ItemCard.vue` with
a shared formatter using the active locale and named date/time presets. Audit
other visible timestamps so equivalent dates use the same formatter across
source, subfeed, composed-feed, and bookmark views, in all layouts.

Use locale conventions for date ordering, month names, punctuation, and time
display. Preserve the existing explicit **UTC** timezone for this issue so
server and browser produce the same day/time; make that timezone clear wherever
a time is shown. Language controls formatting, not the underlying instant.
Retain ISO/epoch values for storage, API payloads, comparisons, and sorting.
Use machine-readable ISO values for any rendered `<time datetime>` attributes.

Missing dates remain absent (or use a translated placeholder where the UI
already requires one); invalid dates must not render `Invalid Date` or throw.
Resolve locale and formatting options identically during SSR and hydration to
avoid an English flash or date hydration mismatch.

## Testing

- Check catalog key parity and interpolation placeholders between English and
  Hungarian; exercise zero, one, and multiple-item messages.
- Settings/API tests cover valid choices, persistence, English defaults,
  malformed stored values, and rejection of unsupported locale updates.
- Component tests cover representative navigation, forms/validation, toasts,
  empty states, accessibility labels, and Nuxt UI messages in both languages.
- Formatter tests use fixed timestamps and explicit UTC to verify English and
  Hungarian date/time output, including a date near midnight, missing/invalid
  input, and unchanged chronological ordering.
- Integration tests cover initial SSR with a saved Hungarian preference,
  matching hydration, live switching with route/query/form state retained, and
  shared item/bookmark cards updating without an origin refresh.
- Tests remain offline and do not depend on the host's locale or timezone.

## Acceptance criteria

- Settings offers English and Magyar; the saved choice applies immediately,
  survives reloads, and is used on the initial server render.
- The existing application interface, accessible labels, and built-in component
  messages are available in both languages, with English fallback for a missing
  key and no raw translation keys shown to the user.
- All displayed application dates/times follow the selected locale using shared
  presets and consistent UTC handling, without hydration mismatches.
- Switching language preserves navigation, filters, layout, form input, and
  stored content; item dates and interface text update together.
- Missing/invalid dates are handled safely, and API/storage timestamps and sort
  semantics remain locale-independent.

## Out of scope

- Additional languages, automatic translation of feed/user content, and a
  translation management service.
- Locale-specific routes, translated slugs, and multilingual SEO.
- User-selectable timezones, custom date patterns, and relative-time displays.
- Translating server logs, developer documentation, or external origin errors
  verbatim; surface a localized application message for failures instead.
- Email digest templates and language preferences for recipients (issue 14).
