import { z } from 'zod'
import { queryParamsSchema } from './source'

// Strict, unlike `sourceCreateSchema`: a subfeed has no server-owned field to
// silently strip, so an unrecognised key — most importantly `sourceId`, which
// only ever comes from the route path — must be rejected rather than dropped.
export const subfeedCreateSchema = z.strictObject({
  name: z.string().trim().min(1),
  queryParams: queryParamsSchema.nullable().optional(),
})

export const subfeedUpdateSchema = subfeedCreateSchema.partial()

export type SubfeedCreateInput = z.infer<typeof subfeedCreateSchema>
export type SubfeedUpdateInput = z.infer<typeof subfeedUpdateSchema>
