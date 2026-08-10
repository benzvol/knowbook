import {
  createError,
  defineEventHandler,
  readBody,
  setResponseStatus,
} from 'h3'
import { feedCreateSchema } from '#shared/schemas/feed'
import { createFeed, findFeedByName } from '../../db/repositories'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = feedCreateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid feed payload',
      data: parsed.error.issues,
    })
  }

  const duplicate = findFeedByName(parsed.data.name)
  if (duplicate) {
    throw createError({
      statusCode: 409,
      statusMessage: `A feed named "${parsed.data.name}" already exists`,
    })
  }

  const feed = createFeed(parsed.data)
  setResponseStatus(event, 201)
  return feed
})
