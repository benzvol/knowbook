import { defineEventHandler } from 'h3'
import { listSourcesWithTags } from '../../db/repositories'

export default defineEventHandler(() => {
  return listSourcesWithTags()
})
