import { createError, defineEventHandler, getQuery } from 'h3'
import { searchQuerySchema } from '#shared/schemas/itemQuery'
import { feedMembers, getSource } from '../../../db/repositories'
import {
  applyItemView,
  feedItems,
  matchesQuery,
  searchFeed,
} from '../../../feed'
import { isNotFoundError } from '../../../utils/errors'
import { getIdParam } from '../../../utils/params'
import { pageSizeSetting, searchMaxPagesSetting } from '../../../utils/settings'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)

  const parsed = searchQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid search query',
      data: parsed.error.issues,
    })
  }
  const query = parsed.data

  try {
    const search = await searchFeed(id, (item) => matchesQuery(item, query.q), {
      maxPages: query.maxPages ?? searchMaxPagesSetting(),
    })

    const defaultPageSize = pageSizeSetting()
    const pageSize = query.pageSize ?? defaultPageSize
    const sourceTitleById = new Map<number, string>()
    for (const member of feedMembers(id)) {
      const source = getSource(member.sourceId)
      if (source) sourceTitleById.set(source.id, source.title)
    }
    const page = {
      ...applyItemView(feedItems(id), query, pageSize, {
        sourceTitleById,
      }),
      defaultPageSize,
    }

    return { page, search }
  } catch (cause) {
    if (isNotFoundError(cause)) {
      throw createError({ statusCode: 404, statusMessage: cause.message })
    }
    throw cause
  }
})
