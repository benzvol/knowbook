import type { BookmarkMoveInput } from '#shared/schemas/bookmark'

/**
 * Turn a Sortable.js drop (old/new visual index within the ids currently on
 * screen) into a `BookmarkMoveInput`. Pure so the drag arithmetic is
 * unit-testable without real pointer events, which Sortable.js needs.
 *
 * A drop at visual index 0 is only the global first bookmark on the first
 * page — on page 2+ it must anchor `before` the row that's now second,
 * otherwise the move would jump the bookmark to the top of the whole list
 * rather than the top of the visible page.
 *
 * Filtering doesn't change this: `after`/`before` an anchor bookmark is
 * globally well-defined even when rows in between are hidden by a filter —
 * the dropped row lands directly next to the anchor.
 */
export function dropTarget(
  ids: number[],
  oldIndex: number,
  newIndex: number,
  isFirstPage: boolean,
): BookmarkMoveInput | null {
  if (oldIndex === newIndex) return null

  const id = ids[oldIndex]
  if (id === undefined) return null

  const withoutId = ids.filter((existing) => existing !== id)
  const next = [...withoutId]
  next.splice(newIndex, 0, id)

  // No-op if the splice landed back where it started (e.g. dragging past
  // the last item and Sortable clamps the index).
  if (next.every((existing, index) => existing === ids[index])) return null

  if (newIndex === 0) {
    if (isFirstPage) return { to: 'first' }
    const beforeId = next[1]
    if (beforeId === undefined) return null
    return { to: 'before', beforeId }
  }

  const afterId = next[newIndex - 1]
  if (afterId === undefined) return null
  return { to: 'after', afterId }
}
