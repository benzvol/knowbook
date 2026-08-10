import { createError, defineEventHandler } from 'h3'
import { feedItems } from '../../../feed'
import { isNotFoundError } from '../../../utils/errors'
import { getIdParam } from '../../../utils/params'

export default defineEventHandler((event) => {
  const id = getIdParam(event)

  try {
    return feedItems(id)
  } catch (cause) {
    if (isNotFoundError(cause)) {
      throw createError({ statusCode: 404, statusMessage: cause.message })
    }
    throw cause
  }
})
