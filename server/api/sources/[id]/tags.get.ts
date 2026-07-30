import { createError, defineEventHandler } from 'h3'
import { getSource, tagsForSource } from '../../../db/repositories'
import { getIdParam } from '../../../utils/params'

export default defineEventHandler((event) => {
  const id = getIdParam(event)
  const source = getSource(id)
  if (!source) {
    throw createError({
      statusCode: 404,
      statusMessage: `Source not found: ${id}`,
    })
  }
  return tagsForSource(id)
})
