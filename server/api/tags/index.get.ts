import { defineEventHandler } from 'h3'
import { listTags } from '../../db/repositories'

export default defineEventHandler(() => {
  return listTags()
})
