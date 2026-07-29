import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { db, DATABASE_PATH } from '../db/client'

// Apply any pending migrations once at server startup so a fresh database file
// (e.g. a new Docker volume) self-initialises. drizzle's migrator records
// applied migrations in __drizzle_migrations, so this is idempotent.
export default defineNitroPlugin(() => {
  try {
    migrate(db, { migrationsFolder: 'server/db/migrations' })
    console.info(`[db] migrations applied (${DATABASE_PATH})`)
  } catch (error) {
    console.error('[db] migration failed', error)
    throw error
  }
})
