import type { NewItem } from '#shared/types'
import { db, type DB } from '../db/client'
import { getItemBySourceGuid, getSource, upsertItem } from '../db/repositories'
import { pages, type PagesOptions } from './pagination'

export interface RefreshSummary {
  sourceId: number
  seen: number
  inserted: number
  updated: number
  pagesFetched: number
}

export interface RefreshSourceOptions extends PagesOptions {
  database?: DB
}

export async function refreshSource(
  sourceId: number,
  opts: RefreshSourceOptions = {},
): Promise<RefreshSummary> {
  const database = opts.database ?? db
  const source = getSource(sourceId, database)
  if (!source) {
    throw new Error(`Source not found: ${sourceId}`)
  }

  const summary: RefreshSummary = {
    sourceId,
    seen: 0,
    inserted: 0,
    updated: 0,
    pagesFetched: 0,
  }

  for await (const page of pages(source, opts)) {
    summary.pagesFetched++

    for (const parsed of page) {
      summary.seen++
      const existing = getItemBySourceGuid(sourceId, parsed.guid, database)
      const newItem: NewItem = { ...parsed, sourceId }
      upsertItem(newItem, database)
      if (existing) summary.updated++
      else summary.inserted++
    }
  }

  return summary
}
