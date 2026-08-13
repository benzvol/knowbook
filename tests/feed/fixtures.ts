import type { Source, Subfeed } from '#shared/types'

export function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: 1,
    url: 'https://example.com/feed',
    title: 'Test source',
    managed: false,
    pagination: null,
    queryParams: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export function makeSubfeed(overrides: Partial<Subfeed> = {}): Subfeed {
  return {
    id: 1,
    sourceId: 1,
    name: 'Test subfeed',
    queryParams: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

export const RSS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example RSS Feed</title>
    <item>
      <title>First post</title>
      <link>https://example.com/first</link>
      <guid>urn:uuid:first</guid>
      <description>The first post's description.</description>
      <pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate>
      <category>tech</category>
      <category>news</category>
    </item>
    <item>
      <title>Second post</title>
      <link>https://example.com/second</link>
      <description>The second post's description.</description>
      <pubDate>Tue, 02 Jan 2024 10:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

export const ATOM_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Atom Feed</title>
  <entry>
    <title>First entry</title>
    <id>urn:uuid:atom-first</id>
    <link rel="alternate" href="https://example.com/atom-first" />
    <summary>The first entry's summary.</summary>
    <published>2024-01-01T10:00:00Z</published>
    <category term="tech" />
    <category term="atom" />
  </entry>
  <entry>
    <title>Second entry</title>
    <link rel="alternate" href="https://example.com/atom-second" />
    <content>The second entry's content.</content>
    <updated>2024-01-02T10:00:00Z</updated>
  </entry>
</feed>`

// One entry has neither guid nor link (dropped); one has an unparseable date.
export const RSS_FEED_WITH_EDGE_CASES = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Edge Case Feed</title>
    <item>
      <title>No identifiers</title>
      <description>Cannot be de-duplicated, so it should be dropped.</description>
    </item>
    <item>
      <title>Bad date</title>
      <link>https://example.com/bad-date</link>
      <guid>urn:uuid:bad-date</guid>
      <pubDate>not-a-real-date</pubDate>
    </item>
  </channel>
</rss>`

export const MALFORMED_FEED = `not xml at all {{{`

export const UNRECOGNISED_FEED = `<?xml version="1.0"?><somethingElse><a>1</a></somethingElse>`

// One fixture per rung of the item-image precedence ladder (server/feed/parse.ts).

export const IMAGE_MEDIA_THUMBNAIL_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <item>
      <title>Thumbnail post</title>
      <guid>thumb-1</guid>
      <link>https://example.com/thumb-1</link>
      <media:thumbnail url="https://img.example.com/thumb.jpg" />
    </item>
  </channel>
</rss>`

// Several media:content entries; only the second is image-typed.
export const IMAGE_MEDIA_CONTENT_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <item>
      <title>Media content post</title>
      <guid>media-content-1</guid>
      <media:content url="https://img.example.com/video-thumb.jpg" medium="video" />
      <media:content url="https://img.example.com/photo.jpg" medium="image" />
    </item>
  </channel>
</rss>`

// The telex.hu case: an image enclosure with length="0", alongside a podcast
// audio enclosure that must never be picked up as an image.
export const IMAGE_ENCLOSURE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Telex-style enclosure</title>
      <guid>enclosure-image-1</guid>
      <link>https://example.com/enclosure-image-1</link>
      <enclosure url="https://telex.hu/img/photo.jpg" type="image/jpeg" length="0" />
    </item>
    <item>
      <title>Podcast enclosure</title>
      <guid>enclosure-audio-1</guid>
      <link>https://example.com/enclosure-audio-1</link>
      <enclosure url="https://example.com/episode.mp3" type="audio/mpeg" length="123456" />
    </item>
  </channel>
</rss>`

export const IMAGE_ITUNES_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <item>
      <title>Podcast episode</title>
      <guid>itunes-1</guid>
      <itunes:image href="https://img.example.com/cover.jpg" />
    </item>
  </channel>
</rss>`

export const IMAGE_ATOM_ENCLOSURE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Atom with image enclosure</title>
    <id>atom-enclosure-1</id>
    <link rel="alternate" href="https://example.com/atom-enclosure-1" />
    <link rel="enclosure" type="image/png" href="https://img.example.com/atom.png" />
  </entry>
</feed>`

// A single item carrying both media:thumbnail and an enclosure — the
// thumbnail must win (it is earlier in the precedence ladder).
export const IMAGE_PRECEDENCE_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <item>
      <title>Precedence post</title>
      <guid>precedence-1</guid>
      <media:thumbnail url="https://img.example.com/thumbnail.jpg" />
      <enclosure url="https://img.example.com/enclosure.jpg" type="image/jpeg" />
    </item>
  </channel>
</rss>`

// Non-standard item-level <image><url>…</url></image>.
export const IMAGE_ITEM_TAG_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Item-level image tag</title>
      <guid>item-image-1</guid>
      <image><url>https://img.example.com/item-image.jpg</url></image>
    </item>
  </channel>
</rss>`

// A relative and a data: URL — both must be rejected (imageUrl: null), not
// passed through for the view layer to render as-is.
export const IMAGE_INVALID_URL_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Relative enclosure</title>
      <guid>relative-1</guid>
      <enclosure url="/img/relative.jpg" type="image/jpeg" />
    </item>
    <item>
      <title>Data URI enclosure</title>
      <guid>data-uri-1</guid>
      <enclosure url="data:image/png;base64,AAAA" type="image/png" />
    </item>
  </channel>
</rss>`
