import { defineEventHandler, setResponseStatus } from 'h3'
import { deleteSubfeed } from '../../db/repositories'
import { getIdParam } from '../../utils/params'

export default defineEventHandler((event) => {
  const id = getIdParam(event)
  deleteSubfeed(id)
  setResponseStatus(event, 204)
  return null
})
