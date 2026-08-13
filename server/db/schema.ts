import { sql } from 'drizzle-orm'
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import type {
  ItemTags,
  PaginationConfig,
  QueryParams,
  SettingValue,
} from '#shared/types/domain'

// Timestamps are stored as integer epoch-milliseconds and surfaced as JS Date.
const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())

const updatedAt = () =>
  integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())

export const tags = sqliteTable(
  'tags',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
  },
  (t) => [uniqueIndex('tags_name_unique').on(t.name)],
)

export const sources = sqliteTable('sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  url: text('url').notNull(),
  title: text('title').notNull(),
  // Server-owned: only the managed-source config loader writes this.
  managed: integer('managed', { mode: 'boolean' }).notNull().default(false),
  pagination: text('pagination', { mode: 'json' }).$type<PaginationConfig>(),
  queryParams: text('query_params', { mode: 'json' }).$type<QueryParams>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const sourceTags = sqliteTable(
  'source_tags',
  {
    sourceId: integer('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.sourceId, t.tagId] })],
)

export const subfeeds = sqliteTable('subfeeds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceId: integer('source_id')
    .notNull()
    .references(() => sources.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  queryParams: text('query_params', { mode: 'json' }).$type<QueryParams>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const feeds = sqliteTable('feeds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

// Membership of sources (optionally narrowed to a subfeed) within a feed.
// Surrogate id + unique index rather than a composite PK: SQLite treats NULL as
// distinct in PKs, which would allow duplicate (feedId, sourceId, NULL) rows.
export const feedSources = sqliteTable(
  'feed_sources',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    feedId: integer('feed_id')
      .notNull()
      .references(() => feeds.id, { onDelete: 'cascade' }),
    sourceId: integer('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    subfeedId: integer('subfeed_id').references(() => subfeeds.id, {
      onDelete: 'cascade',
    }),
  },
  (t) => [
    // Two partial indexes because SQLite treats NULLs as distinct in a plain
    // unique index, which would allow duplicate whole-source memberships.
    // (1) at most one "whole source" (no subfeed) membership per (feed, source).
    uniqueIndex('feed_sources_source_unique')
      .on(t.feedId, t.sourceId)
      .where(sql`${t.subfeedId} is null`),
    // (2) unique subfeed membership per (feed, source, subfeed).
    uniqueIndex('feed_sources_subfeed_unique')
      .on(t.feedId, t.sourceId, t.subfeedId)
      .where(sql`${t.subfeedId} is not null`),
  ],
)

export const items = sqliteTable(
  'items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sourceId: integer('source_id')
      .notNull()
      .references(() => sources.id, { onDelete: 'cascade' }),
    guid: text('guid').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    link: text('link'),
    publishedAt: integer('published_at', { mode: 'timestamp_ms' }),
    tags: text('tags', { mode: 'json' }).$type<ItemTags>(),
    fetchedAt: integer('fetched_at', { mode: 'timestamp_ms' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex('items_source_guid_unique').on(t.sourceId, t.guid)],
)

// Records that a cached item was also seen through a given subfeed of its
// source. Items still cache under the parent `sourceId`
// (`items_source_guid_unique` above is unchanged) — this table only adds the
// extra fact "this row was also seen through subfeed X", so an item can
// belong to several sibling subfeeds at once.
export const itemSubfeeds = sqliteTable(
  'item_subfeeds',
  {
    itemId: integer('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    subfeedId: integer('subfeed_id')
      .notNull()
      .references(() => subfeeds.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.subfeedId] })],
)

export const bookmarks = sqliteTable('bookmarks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  itemId: integer('item_id')
    .notNull()
    .references(() => items.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  tags: text('tags', { mode: 'json' }).$type<ItemTags>(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<SettingValue>(),
})
