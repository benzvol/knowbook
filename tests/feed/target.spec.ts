import { describe, expect, it } from 'vitest'
import { buildPageUrl } from '~~/server/feed/pagination'
import { subfeedTarget } from '~~/server/feed/target'
import { makeSource, makeSubfeed } from './fixtures'

describe('subfeedTarget', () => {
  it('inherits the parent url and pagination', () => {
    const source = makeSource({
      url: 'https://example.com/feed',
      pagination: { pageParam: 'page', startPage: 1 },
    })
    const subfeed = makeSubfeed({ sourceId: source.id })

    const target = subfeedTarget(source, subfeed)

    expect(target.url).toBe(source.url)
    expect(target.pagination).toEqual(source.pagination)
  })

  it('merges queryParams, the subfeed winning on collisions', () => {
    const source = makeSource({ queryParams: { lang: 'en', section: 'a' } })
    const subfeed = makeSubfeed({ queryParams: { section: 'b', extra: '1' } })

    const target = subfeedTarget(source, subfeed)

    expect(target.queryParams).toEqual({
      lang: 'en',
      section: 'b',
      extra: '1',
    })
  })

  it('yields an empty object, not null, when neither side has queryParams', () => {
    const source = makeSource({ queryParams: null })
    const subfeed = makeSubfeed({ queryParams: null })

    const target = subfeedTarget(source, subfeed)

    expect(target.queryParams).toEqual({})
  })

  it('survives a JSON-encoded param through URL construction unaltered', () => {
    const filters = JSON.stringify({
      superTagSiteSlugs: ['g7'],
      superTagSlugs: [null],
      parentId: ['null'],
    })
    const source = makeSource({
      url: 'https://telex.hu/rss/archivum',
      pagination: { pageParam: 'oldal', sizeParam: 'perPage', pageSize: 10 },
    })
    const subfeed = makeSubfeed({ queryParams: { filters } })

    const target = subfeedTarget(source, subfeed)
    const url = buildPageUrl(target, 1)

    // `URLSearchParams.set` percent-encodes the value, so assert the
    // round-trip rather than a literal substring match.
    expect(new URL(url).searchParams.get('filters')).toBe(filters)
    // startPage defaults to 1, and buildPageUrl offsets by `page` (1-based
    // call site here), so page=1 -> 1 + 1 = 2.
    expect(new URL(url).searchParams.get('oldal')).toBe('2')
    expect(new URL(url).searchParams.get('perPage')).toBe('10')
  })
})
