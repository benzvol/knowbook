import { describe, expect, it } from 'vitest'
import { FeedParseError } from '~~/server/feed/errors'
import { parseFeed } from '~~/server/feed/parse'
import {
  ATOM_FEED,
  IMAGE_ATOM_ENCLOSURE_FEED,
  IMAGE_ENCLOSURE_FEED,
  IMAGE_INVALID_URL_FEED,
  IMAGE_ITEM_TAG_FEED,
  IMAGE_ITUNES_FEED,
  IMAGE_MEDIA_CONTENT_FEED,
  IMAGE_MEDIA_THUMBNAIL_FEED,
  IMAGE_PRECEDENCE_FEED,
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

  it('parses to imageUrl: null, not undefined, when an item has no image', () => {
    const items = parseFeed(RSS_FEED)
    expect(items[0]).toHaveProperty('imageUrl', null)
  })
})

describe('parseFeed item images', () => {
  it('extracts media:thumbnail', () => {
    const [item] = parseFeed(IMAGE_MEDIA_THUMBNAIL_FEED)
    expect(item!.imageUrl).toBe('https://img.example.com/thumb.jpg')
  })

  it('extracts the image-typed entry out of several media:content entries', () => {
    const [item] = parseFeed(IMAGE_MEDIA_CONTENT_FEED)
    expect(item!.imageUrl).toBe('https://img.example.com/photo.jpg')
  })

  it('extracts an image/* enclosure (the telex.hu shape, length="0")', () => {
    const [item] = parseFeed(IMAGE_ENCLOSURE_FEED)
    expect(item!.imageUrl).toBe('https://telex.hu/img/photo.jpg')
  })

  it('never treats a non-image enclosure as an image', () => {
    const [, podcastItem] = parseFeed(IMAGE_ENCLOSURE_FEED)
    expect(podcastItem!.imageUrl).toBeNull()
  })

  it('extracts itunes:image href', () => {
    const [item] = parseFeed(IMAGE_ITUNES_FEED)
    expect(item!.imageUrl).toBe('https://img.example.com/cover.jpg')
  })

  it('extracts an Atom image/* enclosure link', () => {
    const [item] = parseFeed(IMAGE_ATOM_ENCLOSURE_FEED)
    expect(item!.imageUrl).toBe('https://img.example.com/atom.png')
  })

  it('extracts an item-level <image><url> as a last resort', () => {
    const [item] = parseFeed(IMAGE_ITEM_TAG_FEED)
    expect(item!.imageUrl).toBe('https://img.example.com/item-image.jpg')
  })

  it('prefers media:thumbnail over an enclosure on the same item', () => {
    const [item] = parseFeed(IMAGE_PRECEDENCE_FEED)
    expect(item!.imageUrl).toBe('https://img.example.com/thumbnail.jpg')
  })

  it('rejects a relative or data: URL, yielding null', () => {
    const [relative, dataUri] = parseFeed(IMAGE_INVALID_URL_FEED)
    expect(relative!.imageUrl).toBeNull()
    expect(dataUri!.imageUrl).toBeNull()
  })
})
