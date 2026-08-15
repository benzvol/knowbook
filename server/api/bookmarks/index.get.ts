import { createError, defineEventHandler, getQuery } from 'h3'
import { bookmarkQuerySchema } from '#shared/schemas/bookmark'
import { listBookmarksWithItems, listSources } from '../../db/repositories'
import { applyBookmarkView } from '../../bookmarks'
import { pageSizeSetting } from '../../utils/settings'

export default defineEventHandler((event) => {
  const parsed = bookmarkQuerySchema.safeParse(getQuery(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid bookmark query',
      data: parsed.error.issues,
    })
  }
  const query = parsed.data

  const defaultPageSize = pageSizeSetting()
  const pageSize = query.pageSize ?? defaultPageSize

  const sourceTitleById = new Map(
    listSources().map((source) => [source.id, source.title]),
  )

  return {
    ...applyBookmarkView(listBookmarksWithItems(), query, pageSize, {
      sourceTitleById,
    }),
    defaultPageSize,
  }
})
