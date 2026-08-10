import { createError, defineEventHandler } from 'h3'
import type { FeedMemberDetail } from '#shared/types'
import {
  feedMembers,
  getFeed,
  getSource,
  getSubfeed,
} from '../../db/repositories'
import { getIdParam } from '../../utils/params'

export default defineEventHandler((event) => {
  const id = getIdParam(event)
  const feed = getFeed(id)
  if (!feed) {
    throw createError({
      statusCode: 404,
      statusMessage: `Feed not found: ${id}`,
    })
  }

  // Per-row `getSource`/`getSubfeed` rather than a join: a feed has few
  // members, so the batched helpers stay reserved for list-page fan-out
  // (`listSourcesWithTags` vs `getSourceWithTags`'s single-row calls).
  const members: FeedMemberDetail[] = []
  for (const member of feedMembers(id)) {
    const source = getSource(member.sourceId)
    // Unreachable in practice: `feed_sources.source_id` cascades on delete.
    if (!source) continue
    members.push({
      ...member,
      source,
      subfeed: member.subfeedId ? (getSubfeed(member.subfeedId) ?? null) : null,
    })
  }

  return { ...feed, members }
})
