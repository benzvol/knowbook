import type { Source } from '#shared/types'

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
