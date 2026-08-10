import { defineEventHandler, setResponseStatus } from 'h3'
import { deleteFeed } from '../../db/repositories'
import { getIdParam } from '../../utils/params'

export default defineEventHandler((event) => {
  const id = getIdParam(event)
  deleteFeed(id)
  setResponseStatus(event, 204)
  return null
})
