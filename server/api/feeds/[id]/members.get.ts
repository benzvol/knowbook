import { createError, defineEventHandler } from 'h3'
import { feedMembers, getFeed } from '../../../db/repositories'
import { getIdParam } from '../../../utils/params'

export default defineEventHandler((event) => {
  const id = getIdParam(event)
  const feed = getFeed(id)
  if (!feed) {
    throw createError({
      statusCode: 404,
      statusMessage: `Feed not found: ${id}`,
    })
  }
  return feedMembers(id)
})
