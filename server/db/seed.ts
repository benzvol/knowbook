/**
 * Dev-only seed: inserts a couple of sample sources and tags so later UI work
 * has data to render. Run manually with `pnpm db:seed`; never automatic.
 *
 * Assumes migrations have been applied (`pnpm db:migrate`).
 */
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { db, DATABASE_PATH } from './client'
import { createSource } from './repositories/sources'
import { createSubfeed } from './repositories/subfeeds'
import { attachTag, createTag } from './repositories/tags'

// Ensure the schema exists even on a brand-new database file.
migrate(db, { migrationsFolder: 'server/db/migrations' })

const daily = createTag({ name: 'daily' })
const dev = createTag({ name: 'dev' })
const world = createTag({ name: 'world' })

const hackerNews = createSource({
  url: 'https://hnrss.org/frontpage',
  title: 'Hacker News',
})
attachTag(hackerNews.id, dev.id)

// Two tags, so the source list's group-by-tag view shows a source under each.
// `pagination` is now what marks a source as news-like.
const bbcNews = createSource({
  url: 'https://feeds.bbci.co.uk/news/rss.xml',
  title: 'BBC News',
  pagination: { pageParam: 'page', sizeParam: 'limit', pageSize: 20 },
})
attachTag(bbcNews.id, daily.id)
attachTag(bbcNews.id, world.id)

// Left untagged on purpose, to populate the "Untagged" group.
createSource({
  url: 'https://lobste.rs/rss',
  title: 'Lobsters',
})

// A telex-style source: the paginated, JSON-filters case subfeeds exist for.
// The column identity (`g7`) lives inside the JSON-encoded `filters` param,
// not as the value of a plain param — the case the old `columnParam` model
// couldn't express.
const telex = createSource({
  url: 'https://telex.hu/rss/archivum',
  title: 'Telex archívum',
  pagination: { pageParam: 'oldal', sizeParam: 'perPage', pageSize: 10 },
})
attachTag(telex.id, world.id)
createSubfeed({
  sourceId: telex.id,
  name: 'g7',
  queryParams: {
    filters: JSON.stringify({
      superTagSiteSlugs: ['g7'],
      superTagSlugs: [null],
      parentId: ['null'],
    }),
  },
})

console.info(`[db] seeded sample data (${DATABASE_PATH})`)
