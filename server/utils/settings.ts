import { getSetting } from '../db/repositories'
import { DEFAULT_MAX_PAGES } from '../feed/pagination'

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 200

function positiveIntOr(value: unknown, fallback: number, max?: number): number {
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    (max == null || value <= max)
  ) {
    return value
  }
  return fallback
}

/**
 * The page size a view falls back to when the request's own `pageSize` query
 * param is absent. Clamped to the same bound `itemQuerySchema` enforces, and
 * ignores a stored value that isn't a valid int rather than throwing — issue
 * 11 adds the UI that writes this key; nothing seeds it here.
 */
export function pageSizeSetting(): number {
  return positiveIntOr(getSetting('pageSize'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
}

/**
 * The search-until-found page cap a request falls back to when its own
 * `maxPages` is absent. Falls back to the engine's own default
 * (`DEFAULT_MAX_PAGES`) rather than a second hard-coded number, so the
 * engine keeps one default and this only overrides it.
 */
export function searchMaxPagesSetting(): number {
  return positiveIntOr(getSetting('searchMaxPages'), DEFAULT_MAX_PAGES)
}
