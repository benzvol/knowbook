import { describe, expect, it } from 'vitest'
import { FeedParseError } from '~~/server/feed/errors'
import { parseFeed } from '~~/server/feed/parse'
import {
  ATOM_FEED,
  MALFORMED_FEED,
  RSS_FEED,
  RSS_FEED_WITH_EDGE_CASES,
  UNRECOGNISED_FEED,
} from './fixtures'

describe('parseFeed', () => {
  it('parses RSS 2.0 items into normalised items', () => {
    const items = parseFeed(RSS_FEED)

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      guid: 'urn:uuid:first',
      title: 'First post',
      description: "The first post's description.",
      link: 'https://example.com/first',
      tags: ['tech', 'news'],
    })
    expect(items[0]!.publishedAt).toBeInstanceOf(Date)
  })

  it('falls back to link when RSS item has no guid', () => {
    const items = parseFeed(RSS_FEED)
    expect(items[1]).toMatchObject({
      guid: 'https://example.com/second',
      link: 'https://example.com/second',
      tags: null,
    })
  })

  it('parses Atom entries into normalised items', () => {
    const items = parseFeed(ATOM_FEED)

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      guid: 'urn:uuid:atom-first',
      title: 'First entry',
      description: "The first entry's summary.",
      link: 'https://example.com/atom-first',
      tags: ['tech', 'atom'],
    })
    expect(items[0]!.publishedAt).toBeInstanceOf(Date)
  })

  it('falls back to link and content when Atom entry has no id/summary', () => {
    const items = parseFeed(ATOM_FEED)
    expect(items[1]).toMatchObject({
      guid: 'https://example.com/atom-second',
      description: "The second entry's content.",
    })
  })

  it('drops entries with neither guid nor link, tolerates bad dates', () => {
    const items = parseFeed(RSS_FEED_WITH_EDGE_CASES)

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ guid: 'urn:uuid:bad-date' })
    expect(items[0]!.publishedAt).toBeNull()
  })

  it('throws FeedParseError for malformed XML', () => {
    expect(() => parseFeed(MALFORMED_FEED)).toThrow(FeedParseError)
  })

  it('throws FeedParseError for an unrecognised feed root', () => {
    expect(() => parseFeed(UNRECOGNISED_FEED)).toThrow(FeedParseError)
  })
})
