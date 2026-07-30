/**
 * Dev-only seed: inserts a couple of sample categories and sources so later UI
 * work has data to render. Run manually with `pnpm db:seed`; never automatic.
 *
 * Assumes migrations have been applied (`pnpm db:migrate`).
 */
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { db, DATABASE_PATH } from './client'
import { createCategory } from './repositories/categories'
import { createSource } from './repositories/sources'
import { attachTag, createTag } from './repositories/tags'

// Ensure the schema exists even on a brand-new database file.
migrate(db, { migrationsFolder: 'server/db/migrations' })

const news = createCategory({ name: 'News' })
const tech = createCategory({ name: 'Technology' })

const daily = createTag({ name: 'daily' })
const dev = createTag({ name: 'dev' })

const hackerNews = createSource({
  url: 'https://hnrss.org/frontpage',
  title: 'Hacker News',
  type: 'standard',
  categoryId: tech.id,
})
attachTag(hackerNews.id, dev.id)

const bbcNews = createSource({
  url: 'https://feeds.bbci.co.uk/news/rss.xml',
  title: 'BBC News',
  type: 'news',
  categoryId: news.id,
  pagination: { pageParam: 'page', sizeParam: 'limit', pageSize: 20 },
})
attachTag(bbcNews.id, daily.id)

console.info(`[db] seeded sample data (${DATABASE_PATH})`)
