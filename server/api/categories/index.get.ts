import { defineEventHandler } from 'h3'
import { listCategories } from '../../db/repositories'

export default defineEventHandler(() => {
  return listCategories()
})
