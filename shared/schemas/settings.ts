import { z } from 'zod'

export const DEFAULT_PAGE_SIZE = 25
export const MIN_PAGE_SIZE = 1
export const MAX_PAGE_SIZE = 200
export const DEFAULT_MAX_PAGES = 5
export const DEFAULT_THEME = 'light' as const
export const DEFAULT_EDITORIAL_COLUMN_RATIO = [1, 1, 1] as const

export const appSettingsSchema = z.object({
  pageSize: z.number().int().min(MIN_PAGE_SIZE).max(MAX_PAGE_SIZE),
  searchMaxPages: z.number().int().positive().safe(),
  theme: z.enum(['light', 'dark', 'system']),
  editorialColumnRatio: z.array(z.number().int().min(1).max(100)).length(3),
})
export const settingsUpdateSchema = appSettingsSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one setting must be provided',
  })
export type AppSettings = z.infer<typeof appSettingsSchema>
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>
export const defaultAppSettings: AppSettings = {
  pageSize: DEFAULT_PAGE_SIZE,
  searchMaxPages: DEFAULT_MAX_PAGES,
  theme: DEFAULT_THEME,
  editorialColumnRatio: [...DEFAULT_EDITORIAL_COLUMN_RATIO],
}
