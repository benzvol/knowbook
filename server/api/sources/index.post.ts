import {
  createError,
  defineEventHandler,
  readBody,
  setResponseStatus,
} from 'h3'
import { sourceCreateSchema } from '#shared/schemas/source'
import {
  createSource,
  findTagsByIds,
  setSourceTags,
} from '../../db/repositories'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = sourceCreateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid source payload',
      data: parsed.error.issues,
    })
  }

  const { tagIds, ...data } = parsed.data

  // Validate tag ids before writing the source, so a bad payload can't leave
  // an orphaned source behind.
  const uniqueTagIds = tagIds ? [...new Set(tagIds)] : undefined
  if (uniqueTagIds) {
    const found = findTagsByIds(uniqueTagIds)
    const foundIds = new Set(found.map((t) => t.id))
    const unknownIds = uniqueTagIds.filter((id) => !foundIds.has(id))
    if (unknownIds.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Unknown tag ids: ${unknownIds.join(', ')}`,
      })
    }
  }

  const source = createSource(data)
  const tags = uniqueTagIds ? setSourceTags(source.id, uniqueTagIds) : []
  setResponseStatus(event, 201)
  return { ...source, tags }
})
