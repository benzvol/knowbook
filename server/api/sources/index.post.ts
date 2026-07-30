import {
  createError,
  defineEventHandler,
  readBody,
  setResponseStatus,
} from 'h3'
import { sourceCreateSchema } from '#shared/schemas/source'
import { createSource } from '../../db/repositories'

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

  const source = createSource(parsed.data)
  setResponseStatus(event, 201)
  return source
})
