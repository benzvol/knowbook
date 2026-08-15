import { createError, defineEventHandler, getQuery } from 'h3'
import { searchQuerySchema } from '#shared/schemas/itemQuery'
import {
  getSource,
  getSubfeed,
  itemsForSubfeed,
} from '../../../db/repositories'
import { applyItemView, matchesQuery, searchSubfeed } from '../../../feed'
import { getIdParam } from '../../../utils/params'
import { pageSizeSetting, searchMaxPagesSetting } from '../../../utils/settings'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const subfeed = getSubfeed(id)
  if (!subfeed) {
    throw createError({
      statusCode: 404,
      statusMessage: `Subfeed not found: ${id}`,
    })
  }
  const source = getSource(subfeed.sourceId)

  const parsed = searchQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid search query',
      data: parsed.error.issues,
    })
  }
  const query = parsed.data

  const search = await searchSubfeed(
    id,
    (item) => matchesQuery(item, query.q),
    { maxPages: query.maxPages ?? searchMaxPagesSetting() },
  )

  const defaultPageSize = pageSizeSetting()
  const pageSize = query.pageSize ?? defaultPageSize
  const page = {
    ...applyItemView(itemsForSubfeed(id), query, pageSize, {
      sourceTitleById: source
        ? new Map([[source.id, source.title]])
        : undefined,
    }),
    defaultPageSize,
  }

  return { page, search }
})
