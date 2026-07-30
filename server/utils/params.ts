import { createError, getRouterParam, type H3Event } from 'h3'

export function getIdParam(event: H3Event): number {
  const raw = getRouterParam(event, 'id')
  const id = Number(raw)
  if (!raw || !Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: `Invalid id: ${raw}` })
  }
  return id
}
