import { z } from 'zod'

export const paginationSchema = z
  .object({
    pageParam: z.string().min(1).optional(),
    sizeParam: z.string().min(1).optional(),
    pageSize: z.number().int().positive().optional(),
    startPage: z.number().int().min(0).optional(),
  })
  .strict()

export const queryParamsSchema = z.record(z.string(), z.string())

export const sourceCreateSchema = z.object({
  url: z.url(),
  title: z.string().min(1),
  type: z.enum(['news', 'standard']).default('standard'),
  managed: z.boolean().default(false),
  categoryId: z.number().int().positive().nullable().optional(),
  pagination: paginationSchema.nullable().optional(),
  queryParams: queryParamsSchema.nullable().optional(),
  tagIds: z.array(z.number().int().positive()).optional(),
})

export const sourceUpdateSchema = sourceCreateSchema.partial()

export const sourceTagsSchema = z.object({
  tagIds: z.array(z.number().int().positive()),
})

export type SourceCreateInput = z.infer<typeof sourceCreateSchema>
export type SourceUpdateInput = z.infer<typeof sourceUpdateSchema>
export type SourceTagsInput = z.infer<typeof sourceTagsSchema>
