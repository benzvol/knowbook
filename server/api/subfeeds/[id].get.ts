import { createError, defineEventHandler } from 'h3'
import { getSubfeed } from '../../db/repositories'
import { getIdParam } from '../../utils/params'

export default defineEventHandler((event) => {
  const id = getIdParam(event)
  const subfeed = getSubfeed(id)
  if (!subfeed) {
    throw createError({
      statusCode: 404,
      statusMessage: `Subfeed not found: ${id}`,
    })
  }
  return subfeed
})
