import { createError, defineEventHandler, readBody } from 'h3'
import { categoryUpdateSchema } from '#shared/schemas/category'
import { updateCategory } from '../../db/repositories'
import { isUniqueViolation } from '../../utils/errors'
import { getIdParam } from '../../utils/params'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const body = await readBody(event)
  const parsed = categoryUpdateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid category payload',
      data: parsed.error.issues,
    })
  }

  try {
    const category = updateCategory(id, parsed.data)
    if (!category) {
      throw createError({
        statusCode: 404,
        statusMessage: `Category not found: ${id}`,
      })
    }
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
