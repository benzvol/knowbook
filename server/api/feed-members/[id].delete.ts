import { createError, defineEventHandler, setResponseStatus } from 'h3'
import { getFeedMember, removeFeedSource } from '../../db/repositories'
import { getIdParam } from '../../utils/params'

export default defineEventHandler((event) => {
  const id = getIdParam(event)

  // Unlike the source/subfeed deletes, this 404s on a missing row rather
  // than being idempotent. A membership id is never user-typed — it only
  // ever reaches the client via GET /api/feeds/:id — so a miss means the
  // caller's member list is already stale, and a 404 tells the UI to
  // refetch rather than silently reporting success for a row someone else
  // already removed.
  if (!getFeedMember(id)) {
    throw createError({
      statusCode: 404,
      statusMessage: `Feed member not found: ${id}`,
    })
  }

  removeFeedSource(id)
  setResponseStatus(event, 204)
  return null
})
