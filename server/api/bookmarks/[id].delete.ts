import { createError, defineEventHandler, setResponseStatus } from 'h3'
import { deleteBookmark, getBookmark } from '../../db/repositories'
import { getIdParam } from '../../utils/params'

export default defineEventHandler((event) => {
  const id = getIdParam(event)
  if (!getBookmark(id)) {
    throw createError({
      statusCode: 404,
      statusMessage: `Bookmark not found: ${id}`,
    })
  }
  deleteBookmark(id)
  setResponseStatus(event, 204)
  return null
})
