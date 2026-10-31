import { exportDocument, fileName } from '../../transfer/service'
import { db } from '../../db/client'
export default defineEventHandler((event) => {
  const document = db.transaction((tx) => exportDocument(tx))
  setHeader(event, 'content-type', 'application/json; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="${fileName('backup')}"`)
  return document
})
