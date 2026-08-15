import { defineEventHandler } from 'h3'
import { listBookmarkRefs } from '../../db/repositories'

export default defineEventHandler(() => {
  return listBookmarkRefs()
})
