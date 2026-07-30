import {
  createError,
  defineEventHandler,
  readBody,
  setResponseStatus,
} from 'h3'
import { tagCreateSchema } from '#shared/schemas/tag'
import { createTag } from '../../db/repositories'
import { isUniqueViolation } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = tagCreateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid tag payload',
      data: parsed.error.issues,
    })
  }

  try {
    const tag = createTag(parsed.data)
    setResponseStatus(event, 201)
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
