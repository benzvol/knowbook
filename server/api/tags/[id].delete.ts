import { defineEventHandler, setResponseStatus } from 'h3'
import { deleteTag } from '../../db/repositories'
import { getIdParam } from '../../utils/params'

export default defineEventHandler((event) => {
  const id = getIdParam(event)
  deleteTag(id)
  setResponseStatus(event, 204)
  return null
})
