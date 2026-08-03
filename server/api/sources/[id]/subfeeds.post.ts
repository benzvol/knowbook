import { createError, defineEventHandler, readBody, setResponseStatus } from 'h3'
import { subfeedCreateSchema } from '#shared/schemas/subfeed'
import {
  createSubfeed,
  findSubfeedByName,
  getSource,
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
  const parsed = subfeedCreateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid subfeed payload',
      data: parsed.error.issues,
    })
  }

  const duplicate = findSubfeedByName(id, parsed.data.name)
  if (duplicate) {
    throw createError({
      statusCode: 409,
      statusMessage: `A subfeed named "${parsed.data.name}" already exists`,
    })
  }

  const subfeed = createSubfeed({ ...parsed.data, sourceId: id })
  setResponseStatus(event, 201)
  return subfeed
})
