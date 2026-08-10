import {
  createError,
  defineEventHandler,
  readBody,
  setResponseStatus,
} from 'h3'
import { feedMemberSchema } from '#shared/schemas/feed'
import {
  addFeedSource,
  getFeed,
  getSource,
  getSubfeed,
} from '../../../db/repositories'
import { isUniqueViolation } from '../../../utils/errors'
import { getIdParam } from '../../../utils/params'

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
  const parsed = feedMemberSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid feed member payload',
      data: parsed.error.issues,
    })
  }

  const { sourceId, subfeedId } = parsed.data

  const source = getSource(sourceId)
  if (!source) {
    throw createError({
      statusCode: 404,
      statusMessage: `Source not found: ${sourceId}`,
    })
  }

  let subfeed = undefined
  if (subfeedId != null) {
    subfeed = getSubfeed(subfeedId)
    if (!subfeed) {
      throw createError({
        statusCode: 404,
        statusMessage: `Subfeed not found: ${subfeedId}`,
      })
    }
    if (subfeed.sourceId !== source.id) {
      throw createError({
        statusCode: 400,
        statusMessage: `Subfeed ${subfeedId} does not belong to source ${source.id}`,
      })
    }
  }

  // All existence checks happen above, before the try/catch: `isUniqueViolation`
  // matches any `SQLITE_CONSTRAINT*` prefix, including `_FOREIGNKEY`, so an FK
  // failure caught here would be mis-reported as a duplicate membership.
  try {
    const member = addFeedSource(id, source.id, subfeedId ?? null)
    setResponseStatus(event, 201)
    return { ...member, source, subfeed: subfeed ?? null }
  } catch (cause) {
    if (isUniqueViolation(cause)) {
      throw createError({
        statusCode: 409,
        statusMessage: subfeed
          ? `"${subfeed.name}" is already a member of this feed`
          : `"${source.title}" is already a member of this feed`,
      })
    }
    throw cause
  }
})
