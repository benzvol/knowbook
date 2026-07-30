import { createError, defineEventHandler, readBody } from 'h3'
import { tagUpdateSchema } from '#shared/schemas/tag'
import { updateTag } from '../../db/repositories'
import { isUniqueViolation } from '../../utils/errors'
import { getIdParam } from '../../utils/params'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const body = await readBody(event)
  const parsed = tagUpdateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid tag payload',
      data: parsed.error.issues,
    })
  }

  try {
    const tag = updateTag(id, parsed.data)
    if (!tag) {
      throw createError({
        statusCode: 404,
        statusMessage: `Tag not found: ${id}`,
      })
    }
    return tag
  } catch (cause) {
    if (isUniqueViolation(cause)) {
      throw createError({
        statusCode: 409,
        statusMessage: `A tag named "${parsed.data.name}" already exists`,
      })
    }
    throw cause
  }
})
