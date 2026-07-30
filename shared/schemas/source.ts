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

// `managed` is deliberately absent: it means "declared by the app maintainer in
// a config file", so only the config loader may write it. The schema is
// non-strict, so a `managed` key in a request body is stripped rather than
// rejected.
export const sourceCreateSchema = z.object({
  url: z.url(),
  title: z.string().min(1),
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
