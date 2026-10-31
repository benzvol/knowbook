import type { ReadingTargetRef } from '#shared/types'
import { db, type DB } from '../client'

const tableFor = { source: 'sources', subfeed: 'subfeeds', feed: 'feeds' } as const

/** Atomically validate, check eligibility, and persist a visit timestamp. */
export function recordVisit(
  target: ReadingTargetRef,
  thresholdMinutes: number,
  database: DB = db,
  now = Date.now(),
): { lastVisitedAt: number; shouldRefresh: boolean } | undefined {
  const table = tableFor[target.kind]
  const run = database.$client.transaction(() => {
    const row = database.$client.prepare(
      `SELECT last_visited_at AS lastVisitedAt FROM ${table} WHERE id = ?`,
    ).get(target.id) as { lastVisitedAt: number | null } | undefined
    if (!row) return undefined
    const previous = row.lastVisitedAt
    const shouldRefresh =
      previous == null || !Number.isFinite(previous) || previous > now ||
      now - previous >= thresholdMinutes * 60_000
    database.$client.prepare(
      `UPDATE ${table} SET last_visited_at = ? WHERE id = ?`,
    ).run(now, target.id)
    return { lastVisitedAt: now, shouldRefresh }
  })
  return run.immediate()
}
