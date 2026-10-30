import { getSetting } from '../db/repositories'
import {
  appSettingsSchema,
  defaultAppSettings,
  type AppSettings,
} from '#shared/schemas/settings'

function storedSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const value = getSetting(key)
  const parsed = appSettingsSchema.shape[key].safeParse(value)
  return parsed.success ? parsed.data : defaultAppSettings[key]
}

export function pageSizeSetting(): number {
  return storedSetting('pageSize')
}
export function searchMaxPagesSetting(): number {
  return storedSetting('searchMaxPages')
}
export function themeSetting(): AppSettings['theme'] {
  return storedSetting('theme')
}
export function editorialColumnRatioSetting(): [number, number, number] {
  return storedSetting('editorialColumnRatio') as [number, number, number]
}
export function allAppSettings(): AppSettings {
  return {
    pageSize: pageSizeSetting(),
    searchMaxPages: searchMaxPagesSetting(),
    theme: themeSetting(),
    editorialColumnRatio: editorialColumnRatioSetting(),
  }
}
