import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

/** Location of the SQLite database file (see Docker/compose env wiring). */
export const DATABASE_PATH =
  process.env.DATABASE_PATH ?? './data/knowbook.sqlite'

// better-sqlite3 is synchronous; the Drizzle instance is likewise sync.
export type DB = ReturnType<typeof createDb>

function createDb(path: string) {
  const sqlite = new Database(path)
  // WAL improves concurrent read/write; foreign_keys must be enabled per
  // connection (SQLite defaults it off).
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  return drizzle({ client: sqlite, schema })
}

// Reuse a single connection across the process. Module scope is per-process in
// Nitro, so this is created once and shared by every request.
let _db: DB | undefined

export const db: DB = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    _db ??= createDb(DATABASE_PATH)
    return Reflect.get(_db, prop, receiver)
  },
})
