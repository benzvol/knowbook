import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { DB } from '~~/server/db/client'
import * as schema from '~~/server/db/schema'

/**
 * Build a fresh, migrated in-memory database for a test. foreign_keys is
 * enabled per connection (as in production) so cascade/FK behaviour is tested.
 */
export function createTestDb(): DB {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle({ client: sqlite, schema })
  migrate(db, { migrationsFolder: 'server/db/migrations' })
  return db
}
