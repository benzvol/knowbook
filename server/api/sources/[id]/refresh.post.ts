import { createError, defineEventHandler, readBody } from 'h3'
import { refreshSource } from '../../../feed'
import { getIdParam } from '../../../utils/params'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const body = (await readBody(event)) as { maxPages?: number } | undefined

  try {
    return await refreshSource(id, { maxPages: body?.maxPages })
  } catch (cause) {
    if (
      cause instanceof Error &&
      cause.message.startsWith('Source not found')
    ) {
      throw createError({ statusCode: 404, statusMessage: cause.message })
    }
    throw cause
  }
})
