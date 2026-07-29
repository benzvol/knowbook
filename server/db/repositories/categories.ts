import { eq } from 'drizzle-orm'
import type { Category, NewCategory } from '#shared/types'
import { db, type DB } from '../client'
import { categories } from '../schema'

// better-sqlite3 is synchronous, so these helpers are sync (no await needed).
// `database` defaults to the shared singleton; tests pass an in-memory DB.

export function listCategories(database: DB = db): Category[] {
  return database.select().from(categories).all()
}

export function getCategory(
  id: number,
  database: DB = db,
): Category | undefined {
  return database.select().from(categories).where(eq(categories.id, id)).get()
}

export function createCategory(data: NewCategory, database: DB = db): Category {
  return database.insert(categories).values(data).returning().get()
}

export function updateCategory(
  id: number,
  patch: Partial<NewCategory>,
  database: DB = db,
): Category | undefined {
  return database
    .update(categories)
    .set(patch)
    .where(eq(categories.id, id))
    .returning()
    .get()
}

export function deleteCategory(id: number, database: DB = db): void {
  database.delete(categories).where(eq(categories.id, id)).run()
}
