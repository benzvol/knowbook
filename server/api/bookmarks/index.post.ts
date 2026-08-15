import {
  createError,
  defineEventHandler,
  readBody,
  setResponseStatus,
} from 'h3'
import { bookmarkCreateSchema } from '#shared/schemas/bookmark'
import { createBookmark, getItem } from '../../db/repositories'
import { isUniqueViolation } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = bookmarkCreateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid bookmark payload',
      data: parsed.error.issues,
    })
  }
  const { itemId, tags } = parsed.data

  const item = getItem(itemId)
  if (!item) {
    throw createError({
      statusCode: 404,
      statusMessage: `Item not found: ${itemId}`,
    })
  }

  // The existence check happens above, before the try/catch:
  // `isUniqueViolation` matches any `SQLITE_CONSTRAINT*` prefix, including
  // `_FOREIGNKEY`, so an FK failure caught here would be mis-reported as an
  // existing bookmark.
  try {
    const bookmark = createBookmark({ itemId, tags })
    setResponseStatus(event, 201)
    return { ...bookmark, item }
  } catch (cause) {
    if (isUniqueViolation(cause)) {
      throw createError({
        statusCode: 409,
        statusMessage: `Item ${itemId} is already bookmarked`,
      })
    }
    throw cause
  }
})
