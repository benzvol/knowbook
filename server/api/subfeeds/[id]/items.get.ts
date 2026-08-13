import { createError, defineEventHandler, getQuery } from 'h3'
import { itemQuerySchema } from '#shared/schemas/itemQuery'
import {
  getSource,
  getSubfeed,
  itemsForSubfeed,
} from '../../../db/repositories'
import { applyItemView } from '../../../feed'
import { getIdParam } from '../../../utils/params'
import { pageSizeSetting } from '../../../utils/settings'

export default defineEventHandler((event) => {
  const id = getIdParam(event)
  const subfeed = getSubfeed(id)
  if (!subfeed) {
    throw createError({
      statusCode: 404,
      statusMessage: `Subfeed not found: ${id}`,
    })
  }
  // Missing only if the parent was deleted concurrently with this request —
  // the FK cascade would take the subfeed with it, so this is best-effort.
  const source = getSource(subfeed.sourceId)

  const parsed = itemQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid item query',
      data: parsed.error.issues,
    })
  }
  const query = parsed.data
  const pageSize = query.pageSize ?? pageSizeSetting()

  return applyItemView(itemsForSubfeed(id), query, pageSize, {
    sourceTitleById: source ? new Map([[source.id, source.title]]) : undefined,
  })
})
