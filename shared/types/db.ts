// Row types inferred from the Drizzle schema, re-exported for use on both the
// server and the client. These are `type`-only exports, so no server-side
// runtime (schema, better-sqlite3) leaks into the client bundle.
import type {
  bookmarks,
  categories,
  feeds,
  feedSources,
  items,
  settings,
  sources,
  sourceTags,
  subfeeds,
  tags,
} from '~~/server/db/schema'

export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert

export type Tag = typeof tags.$inferSelect
export type NewTag = typeof tags.$inferInsert

export type Source = typeof sources.$inferSelect
export type NewSource = typeof sources.$inferInsert

// A source hydrated with its tags, as returned by the list/get source routes.
export type SourceWithTags = Source & { tags: Tag[] }

export type SourceTag = typeof sourceTags.$inferSelect
export type NewSourceTag = typeof sourceTags.$inferInsert

export type Subfeed = typeof subfeeds.$inferSelect
export type NewSubfeed = typeof subfeeds.$inferInsert

export type Feed = typeof feeds.$inferSelect
export type NewFeed = typeof feeds.$inferInsert

export type FeedSource = typeof feedSources.$inferSelect
export type NewFeedSource = typeof feedSources.$inferInsert

export type Item = typeof items.$inferSelect
export type NewItem = typeof items.$inferInsert

export type Bookmark = typeof bookmarks.$inferSelect
export type NewBookmark = typeof bookmarks.$inferInsert

export type Setting = typeof settings.$inferSelect
export type NewSetting = typeof settings.$inferInsert
