import { z } from 'zod'
import { commitImport } from '../../transfer/service'
import { db } from '../../db/client'
export default defineEventHandler(async (event) => {
  const parsed = z.object({ token: z.string().min(1) }).safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Missing import token' })
  return commitImport(parsed.data.token, db)
})
