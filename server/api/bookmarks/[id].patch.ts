import { createError, defineEventHandler, readBody } from 'h3'
import { bookmarkUpdateSchema } from '#shared/schemas/bookmark'
import { getBookmarkWithItem, updateBookmark } from '../../db/repositories'
import { getIdParam } from '../../utils/params'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const body = await readBody(event)
  const parsed = bookmarkUpdateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid bookmark payload',
      data: parsed.error.issues,
    })
  }

  const bookmark = updateBookmark(id, parsed.data)
  if (!bookmark) {
    throw createError({
      statusCode: 404,
      statusMessage: `Bookmark not found: ${id}`,
    })
  }
  return getBookmarkWithItem(id)
})
