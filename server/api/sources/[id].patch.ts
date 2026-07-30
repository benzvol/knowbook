import { createError, defineEventHandler, readBody } from 'h3'
import { sourceUpdateSchema } from '#shared/schemas/source'
import { updateSource } from '../../db/repositories'
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

  const source = updateSource(id, parsed.data)
  if (!source) {
    throw createError({
      statusCode: 404,
      statusMessage: `Source not found: ${id}`,
    })
  }
  return source
})
