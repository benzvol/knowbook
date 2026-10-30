import { setSetting } from '../../db/repositories'
import { db } from '../../db/client'
import { settingsUpdateSchema } from '#shared/schemas/settings'
import { allAppSettings } from '../../utils/settings'
export default defineEventHandler(async (event) => {
  const input = settingsUpdateSchema.safeParse(await readBody(event))
  if (!input.success)
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid settings',
      data: input.error.flatten(),
    })
  db.transaction((tx) => {
    for (const [key, value] of Object.entries(input.data))
      setSetting(key, value, tx)
  })
  return allAppSettings()
})
