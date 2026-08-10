import { createError, defineEventHandler, readBody } from 'h3'
import { feedUpdateSchema } from '#shared/schemas/feed'
import { findFeedByName, getFeed, updateFeed } from '../../db/repositories'
import { getIdParam } from '../../utils/params'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const feed = getFeed(id)
  if (!feed) {
    throw createError({
      statusCode: 404,
      statusMessage: `Feed not found: ${id}`,
    })
  }

  const body = await readBody(event)
  const parsed = feedUpdateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid feed payload',
      data: parsed.error.issues,
    })
  }

  if (parsed.data.name) {
    const duplicate = findFeedByName(parsed.data.name, id)
    if (duplicate) {
      throw createError({
        statusCode: 409,
        statusMessage: `A feed named "${parsed.data.name}" already exists`,
      })
    }
  }

  return updateFeed(id, parsed.data)
})
