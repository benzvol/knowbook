// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'

const { dropTarget } = await import('~/utils/bookmarkMove')

describe('dropTarget', () => {
  it('returns null when the row did not move', () => {
    expect(dropTarget([1, 2, 3], 1, 1, true)).toBeNull()
  })

  it('drop at the top of the first page moves to first', () => {
    expect(dropTarget([1, 2, 3, 4], 2, 0, true)).toEqual({ to: 'first' })
  })

  it('drop at the top of a later page anchors before the new second row', () => {
    // page 2, visible ids [5, 6, 7, 8] -> drag id 7 to the top
    expect(dropTarget([5, 6, 7, 8], 2, 0, false)).toEqual({
      to: 'before',
      beforeId: 5,
    })
  })

  it('a downward move anchors after the row now above it', () => {
    // drag id 1 (index 0) down to index 2 among [1,2,3,4]
    expect(dropTarget([1, 2, 3, 4], 0, 2, true)).toEqual({
      to: 'after',
      afterId: 3,
    })
  })

  it('an upward move (not to the top) anchors after the row now above it', () => {
    // drag id 4 (index 3) up to index 1 among [1,2,3,4]
    expect(dropTarget([1, 2, 3, 4], 3, 1, true)).toEqual({
      to: 'after',
      afterId: 1,
    })
  })

  it('returns null for an unknown source index', () => {
    expect(dropTarget([1, 2, 3], 9, 0, true)).toBeNull()
  })
})
