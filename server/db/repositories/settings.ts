import { eq } from 'drizzle-orm'
import type { Setting, SettingValue } from '#shared/types'
import { db, type DB } from '../client'
import { settings } from '../schema'

export function getAllSettings(database: DB = db): Setting[] {
  return database.select().from(settings).all()
}

export function getSetting(
  key: string,
  database: DB = db,
): SettingValue | undefined {
  return database.select().from(settings).where(eq(settings.key, key)).get()
    ?.value
}

/** Insert or update a single key/value setting. */
export function setSetting(
  key: string,
  value: SettingValue,
  database: DB = db,
): Setting {
  return database
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .returning()
    .get()
}

export function deleteSetting(key: string, database: DB = db): void {
  database.delete(settings).where(eq(settings.key, key)).run()
}
