import { z } from 'zod'

// Normalises a query param that may arrive as a single string, a
// comma-separated string, or (when repeated) an array of strings, into one
// flat string array. Used for `tags` and `sourceIds` below — both accept
// either form on the wire.
function toStringArray(value: unknown): string[] {
  if (value == null) return []
  const raw = Array.isArray(value) ? value : [value]
  return raw
    .flatMap((v) => String(v).split(','))
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

// These arrive as URL query params, not a JSON body, so coercion (numbers,
// repeated/comma-separated arrays) lives in the schema rather than in each
// route. Plain `z.object`, not `.strict()`: a stray client-only `mode` param
// (the view-layout switch, never sent to the API on purpose) must be ignored
// rather than rejected with a 400.
export const itemQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  // AND semantics: an item must carry every selected tag (applied in
  // server/feed/view.ts), matching the source list's tag filter.
  tags: z.preprocess(toStringArray, z.array(z.string().min(1))).default([]),
  // Meaningful only on a feed view (narrow to some members' items); ignored
  // by the source/subfeed views, which have only one member to begin with.
  sourceIds: z
    .preprocess(toStringArray, z.array(z.coerce.number().int().positive()))
    .default([]),
  sort: z.enum(['newest', 'oldest', 'title', 'fetched']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
})

// A search-until-found with no `q` is meaningless, so this narrows `q` to
// required on top of the same shape/coercion as a plain view query.
export const searchQuerySchema = itemQuerySchema
  .extend({ maxPages: z.coerce.number().int().min(1).optional() })
  .required({ q: true })

export type ItemQueryInput = z.infer<typeof itemQuerySchema>
export type SearchQueryInput = z.infer<typeof searchQuerySchema>
