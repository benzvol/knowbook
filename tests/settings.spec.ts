import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  appSettingsSchema,
  defaultAppSettings,
  settingsUpdateSchema,
} from '#shared/schemas/settings'

const getSetting = vi.fn()
vi.mock('~~/server/db/repositories', () => ({
  getSetting: (...args: unknown[]) => getSetting(...args),
}))
const helpers = await import('~~/server/utils/settings')

describe('settings schemas', () => {
  it('provides the documented defaults', () => {
    expect(defaultAppSettings).toEqual({
      pageSize: 25,
      searchMaxPages: 5,
      theme: 'light',
      editorialColumnRatio: [1, 1, 1],
    })
    expect(appSettingsSchema.safeParse(defaultAppSettings).success).toBe(true)
  })
  it('validates bounds and strict nonempty partial updates', () => {
    expect(settingsUpdateSchema.safeParse({ pageSize: 1 }).success).toBe(true)
    expect(settingsUpdateSchema.safeParse({ pageSize: 201 }).success).toBe(
      false,
    )
    expect(
      settingsUpdateSchema.safeParse({
        searchMaxPages: Number.MAX_SAFE_INTEGER + 1,
      }).success,
    ).toBe(false)
    expect(settingsUpdateSchema.safeParse({ theme: 'system' }).success).toBe(
      true,
    )
    expect(
      settingsUpdateSchema.safeParse({ editorialColumnRatio: [1, 0, 2] })
        .success,
    ).toBe(false)
    expect(settingsUpdateSchema.safeParse({}).success).toBe(false)
    expect(settingsUpdateSchema.safeParse({ internal: true }).success).toBe(
      false,
    )
  })
})

describe('stored settings fallback', () => {
  beforeEach(() => getSetting.mockReset())
  it('falls back independently for missing or invalid values', () => {
    getSetting.mockImplementation(
      (key: string) =>
        ({
          pageSize: 50,
          searchMaxPages: -1,
          theme: 'dark',
          editorialColumnRatio: [1, 2],
        })[key],
    )
    expect(helpers.allAppSettings()).toEqual({
      pageSize: 50,
      searchMaxPages: 5,
      theme: 'dark',
      editorialColumnRatio: [1, 1, 1],
    })
  })
})
