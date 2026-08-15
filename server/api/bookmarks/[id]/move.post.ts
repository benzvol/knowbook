import { createError, defineEventHandler, readBody } from 'h3'
import { bookmarkMoveSchema } from '#shared/schemas/bookmark'
import { moveBookmark } from '../../../db/repositories'
import { getIdParam } from '../../../utils/params'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const body = await readBody(event)
  const parsed = bookmarkMoveSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid move payload',
      data: parsed.error.issues,
    })
  }

  const refs = moveBookmark(id, parsed.data)
  if (!refs) {
    throw createError({
      statusCode: 404,
      statusMessage: `Bookmark (or move target) not found: ${id}`,
    })
  }
  return refs
})
