import { prepareImport, transferMaxBytes } from '../../transfer/service'
import { db } from '../../db/client'
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (Buffer.byteLength(JSON.stringify(body ?? {})) > transferMaxBytes) throw createError({ statusCode: 413, statusMessage: `Import file exceeds the ${Math.floor(transferMaxBytes / 1024 / 1024)} MiB limit` })
  return prepareImport(body, db)
})
