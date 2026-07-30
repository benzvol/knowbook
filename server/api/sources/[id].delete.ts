import { defineEventHandler, setResponseStatus } from 'h3'
import { deleteSource } from '../../db/repositories'
import { getIdParam } from '../../utils/params'

export default defineEventHandler((event) => {
  const id = getIdParam(event)
  deleteSource(id)
  setResponseStatus(event, 204)
  return null
})
