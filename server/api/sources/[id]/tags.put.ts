import { createError, defineEventHandler, readBody } from 'h3'
import { sourceTagsSchema } from '#shared/schemas/source'
import {
  findTagsByIds,
  getSource,
  setSourceTags,
} from '../../../db/repositories'
import { getIdParam } from '../../../utils/params'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const source = getSource(id)
  if (!source) {
    throw createError({
      statusCode: 404,
      statusMessage: `Source not found: ${id}`,
    })
  }

  const body = await readBody(event)
  const parsed = sourceTagsSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid tags payload',
      data: parsed.error.issues,
    })
  }

  const tagIds = [...new Set(parsed.data.tagIds)]
  const found = findTagsByIds(tagIds)
  const foundIds = new Set(found.map((t) => t.id))
  const unknownIds = tagIds.filter((tagId) => !foundIds.has(tagId))
  if (unknownIds.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Unknown tag ids: ${unknownIds.join(', ')}`,
    })
  }

  return setSourceTags(id, tagIds)
})
