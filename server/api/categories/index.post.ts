import {
  createError,
  defineEventHandler,
  readBody,
  setResponseStatus,
} from 'h3'
import { categoryCreateSchema } from '#shared/schemas/category'
import { createCategory } from '../../db/repositories'
import { isUniqueViolation } from '../../utils/errors'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = categoryCreateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid category payload',
      data: parsed.error.issues,
    })
  }

  try {
    const category = createCategory(parsed.data)
    setResponseStatus(event, 201)
    return category
  } catch (cause) {
    if (isUniqueViolation(cause)) {
      throw createError({
        statusCode: 409,
        statusMessage: `A category named "${parsed.data.name}" already exists`,
      })
    }
    throw cause
  }
})
