import { z } from 'zod'

export const tagCreateSchema = z.object({
  name: z.string().trim().min(1),
})

export const tagUpdateSchema = tagCreateSchema.partial()

export type TagCreateInput = z.infer<typeof tagCreateSchema>
export type TagUpdateInput = z.infer<typeof tagUpdateSchema>
