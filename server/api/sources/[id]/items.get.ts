import { createError, defineEventHandler, getQuery } from 'h3'
import { itemQuerySchema } from '#shared/schemas/itemQuery'
import { getSource, itemsForSource } from '../../../db/repositories'
import { applyItemView } from '../../../feed'
import { getIdParam } from '../../../utils/params'
import { pageSizeSetting } from '../../../utils/settings'

export default defineEventHandler((event) => {
  const id = getIdParam(event)
  const source = getSource(id)
  if (!source) {
    throw createError({
      statusCode: 404,
      statusMessage: `Source not found: ${id}`,
    })
  }

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

  return applyItemView(itemsForSource(id), query, pageSize, {
    sourceTitleById: new Map([[source.id, source.title]]),
  })
})
