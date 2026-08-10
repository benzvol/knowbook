import { z } from 'zod'

// Strict, as in `subfeedCreateSchema`: a feed has no server-owned field to
// silently strip, so an unrecognised key must be rejected rather than dropped.
export const feedCreateSchema = z.strictObject({
  name: z.string().trim().min(1),
})

export const feedUpdateSchema = feedCreateSchema.partial()

// Add-member payload. `feedId` comes from the route path, never the body —
// strict so a body-borne `feedId` 400s instead of being silently ignored.
export const feedMemberSchema = z.strictObject({
  sourceId: z.number().int().positive(),
  subfeedId: z.number().int().positive().nullable().optional(),
})

export type FeedCreateInput = z.infer<typeof feedCreateSchema>
export type FeedUpdateInput = z.infer<typeof feedUpdateSchema>
export type FeedMemberInput = z.infer<typeof feedMemberSchema>
