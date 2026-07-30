import { createError, defineEventHandler } from 'h3'
import { getCategory } from '../../db/repositories'
import { getIdParam } from '../../utils/params'

export default defineEventHandler((event) => {
  const id = getIdParam(event)
  const category = getCategory(id)
  if (!category) {
    throw createError({
      statusCode: 404,
      statusMessage: `Category not found: ${id}`,
    })
  }
  return category
})
