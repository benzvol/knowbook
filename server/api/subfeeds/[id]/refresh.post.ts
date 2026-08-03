import { createError, defineEventHandler, readBody } from 'h3'
import { refreshSubfeed } from '../../../feed'
import { isNotFoundError } from '../../../utils/errors'
import { getIdParam } from '../../../utils/params'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const body = (await readBody(event)) as { maxPages?: number } | undefined

  try {
    return await refreshSubfeed(id, { maxPages: body?.maxPages })
  } catch (cause) {
    if (isNotFoundError(cause)) {
      throw createError({ statusCode: 404, statusMessage: cause.message })
    }
    throw cause
  }
})
