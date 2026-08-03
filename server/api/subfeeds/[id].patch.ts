import { createError, defineEventHandler, readBody } from 'h3'
import { subfeedUpdateSchema } from '#shared/schemas/subfeed'
import {
  findSubfeedByName,
  getSubfeed,
  updateSubfeed,
} from '../../db/repositories'
import { getIdParam } from '../../utils/params'

export default defineEventHandler(async (event) => {
  const id = getIdParam(event)
  const subfeed = getSubfeed(id)
  if (!subfeed) {
    throw createError({
      statusCode: 404,
      statusMessage: `Subfeed not found: ${id}`,
    })
  }

  const body = await readBody(event)
  const parsed = subfeedUpdateSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid subfeed payload',
      data: parsed.error.issues,
    })
  }

  if (parsed.data.name) {
    const duplicate = findSubfeedByName(subfeed.sourceId, parsed.data.name, id)
    if (duplicate) {
      throw createError({
        statusCode: 409,
        statusMessage: `A subfeed named "${parsed.data.name}" already exists`,
      })
    }
  }

  return updateSubfeed(id, parsed.data)
})
