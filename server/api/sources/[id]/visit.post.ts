import { createError, defineEventHandler } from 'h3'
import type { ReadingTargetRef } from '#shared/types'
import { recordVisit } from '../../../db/repositories'
import { pendingRefresh, refreshSource } from '../../../feed'
import { autoRefreshThresholdMinutesSetting } from '../../../utils/settings'
import { getIdParam } from '../../../utils/params'

export default defineEventHandler(async (event) => {
  const target: ReadingTargetRef = { kind: 'source', id: getIdParam(event) }
  const visit = recordVisit(target, autoRefreshThresholdMinutesSetting())
  if (!visit) throw createError({ statusCode: 404, statusMessage: 'Source not found' })
  const summary = visit.shouldRefresh ? await refreshSource(target.id) : await pendingRefresh(target) ?? null
  return { lastVisitedAt: new Date(visit.lastVisitedAt).toISOString(), summary }
})
