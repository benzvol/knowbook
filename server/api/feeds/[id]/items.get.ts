import { createError, defineEventHandler, getQuery } from 'h3'
import { itemQuerySchema } from '#shared/schemas/itemQuery'
import { feedMembers, getSource } from '../../../db/repositories'
import { applyItemView, feedItems } from '../../../feed'
import { isNotFoundError } from '../../../utils/errors'
import { getIdParam } from '../../../utils/params'
import { pageSizeSetting } from '../../../utils/settings'

export default defineEventHandler((event) => {
  const id = getIdParam(event)

  const parsed = itemQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid item query',
      data: parsed.error.issues,
    })
  }
  const query = parsed.data

  try {
    const items = feedItems(id)
    const defaultPageSize = pageSizeSetting()
    const pageSize = query.pageSize ?? defaultPageSize

    // Member source titles for facets.sources — per-row `getSource`, as
    // `GET /api/feeds/:id` already does (few members, no join).
    const sourceTitleById = new Map<number, string>()
    for (const member of feedMembers(id)) {
      const source = getSource(member.sourceId)
      if (source) sourceTitleById.set(source.id, source.title)
    }

    return {
      ...applyItemView(items, query, pageSize, { sourceTitleById }),
      defaultPageSize,
    }
  } catch (cause) {
    if (isNotFoundError(cause)) {
      throw createError({ statusCode: 404, statusMessage: cause.message })
    }
    throw cause
  }
})
