import { createError, defineEventHandler, getQuery } from 'h3'
import { searchQuerySchema } from '#shared/schemas/itemQuery'
import { getSource, itemsForSource } from '../../../db/repositories'
import { applyItemView, matchesQuery, searchSource } from '../../../feed'
import { getIdParam } from '../../../utils/params'
import { pageSizeSetting, searchMaxPagesSetting } from '../../../utils/settings'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const source = getSource(id)
  if (!source) {
    throw createError({
      statusCode: 404,
      statusMessage: `Source not found: ${id}`,
    })
  }

  const parsed = searchQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid search query',
      data: parsed.error.issues,
    })
  }
  const query = parsed.data

  const search = await searchSource(id, (item) => matchesQuery(item, query.q), {
    maxPages: query.maxPages ?? searchMaxPagesSetting(),
  })

  const pageSize = query.pageSize ?? pageSizeSetting()
  const page = applyItemView(itemsForSource(id), query, pageSize, {
    sourceTitleById: new Map([[source.id, source.title]]),
  })

  return { page, search }
})
