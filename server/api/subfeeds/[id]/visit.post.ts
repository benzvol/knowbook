import { createError, defineEventHandler } from 'h3'
import type { ReadingTargetRef } from '#shared/types'
import { recordVisit } from '../../../db/repositories'
import { pendingRefresh, refreshSubfeed } from '../../../feed'
import { autoRefreshThresholdMinutesSetting } from '../../../utils/settings'
import { getIdParam } from '../../../utils/params'

export default defineEventHandler(async (event) => {
  const target: ReadingTargetRef = { kind: 'subfeed', id: getIdParam(event) }
  const visit = recordVisit(target, autoRefreshThresholdMinutesSetting())
  if (!visit) throw createError({ statusCode: 404, statusMessage: 'Subfeed not found' })
  const summary = visit.shouldRefresh ? await refreshSubfeed(target.id) : await pendingRefresh(target) ?? null
  return { lastVisitedAt: new Date(visit.lastVisitedAt).toISOString(), summary }
})
