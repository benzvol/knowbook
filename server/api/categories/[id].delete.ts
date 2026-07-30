import { defineEventHandler, setResponseStatus } from 'h3'
import { deleteCategory } from '../../db/repositories'
import { getIdParam } from '../../utils/params'

export default defineEventHandler((event) => {
  const id = getIdParam(event)
  deleteCategory(id)
  setResponseStatus(event, 204)
  return null
})
