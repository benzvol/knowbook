import { createError, defineEventHandler, readBody } from 'h3'
import { sourceUpdateSchema } from '#shared/schemas/source'
import {
  findTagsByIds,
  setSourceTags,
  tagsForSource,
  updateSource,
} from '../../db/repositories'
import { getIdParam } from '../../utils/params'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const body = await readBody(event)
  const parsed = sourceUpdateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid source payload',
      data: parsed.error.issues,
    })
  }

  const { tagIds, ...data } = parsed.data

  // A patch that omits `tagIds` must not clear the existing tags.
  const uniqueTagIds = tagIds ? [...new Set(tagIds)] : undefined
  if (uniqueTagIds) {
    const found = findTagsByIds(uniqueTagIds)
    const foundIds = new Set(found.map((t) => t.id))
    const unknownIds = uniqueTagIds.filter((tagId) => !foundIds.has(tagId))
    if (unknownIds.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Unknown tag ids: ${unknownIds.join(', ')}`,
      })
    }
  }

  const source = updateSource(id, data)
  if (!source) {
    throw createError({
      statusCode: 404,
      statusMessage: `Source not found: ${id}`,
    })
  }

  const tags = uniqueTagIds
    ? setSourceTags(id, uniqueTagIds)
    : tagsForSource(id)
  return { ...source, tags }
})
