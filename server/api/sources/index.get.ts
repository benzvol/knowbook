import { defineEventHandler } from 'h3'
import { listSources } from '../../db/repositories'

export default defineEventHandler(() => {
  return listSources()
})
