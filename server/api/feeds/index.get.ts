import { defineEventHandler } from 'h3'
import { listFeedsWithCounts } from '../../db/repositories'

export default defineEventHandler(() => {
  return listFeedsWithCounts()
})
