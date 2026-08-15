import { z } from 'zod'
import { itemQuerySchema } from './itemQuery'

// `sortOrder` is deliberately absent, the way `managed` is absent from
// `sourceCreateSchema` (shared/schemas/source.ts): position is server-owned,
// written only by `createBookmark`'s default and `moveBookmark`. Non-strict,
// so a client that sends one has it stripped rather than 400'd.
export const bookmarkCreateSchema = z.object({
  itemId: z.number().int().positive(),
  tags: z.array(z.string().trim().min(1)).optional(),
})

// Strict: tags are the only user-editable field, so an unrecognised key is a
// mistake worth reporting, not silently ignoring (feedCreateSchema's
// reasoning). Nullable so a bookmark's tags can be cleared back to `null`.
export const bookmarkUpdateSchema = z.strictObject({
  tags: z.array(z.string().trim().min(1)).nullable(),
})

export const bookmarkMoveSchema = z.discriminatedUnion('to', [
  z.strictObject({ to: z.literal('first') }),
  z.strictObject({ to: z.literal('last') }),
  z.strictObject({
    to: z.literal('after'),
    afterId: z.number().int().positive(),
  }),
  z.strictObject({
    to: z.literal('before'),
    beforeId: z.number().int().positive(),
  }),
])

// Extends the item query rather than widening it: `q`, `tags`, `sourceIds`,
// `page` and `pageSize` are inherited unchanged, so the URL format, param
// coercion and page-size bound are shared by construction. `fetched` is
// dropped (when an item was last re-fetched says nothing about a bookmark);
// `manual` must not leak back into `itemQuerySchema` — an item view has no
// per-item position to sort by.
export const bookmarkQuerySchema = itemQuerySchema.extend({
  sort: z
    .enum(['manual', 'bookmarked', 'newest', 'oldest', 'title'])
    .default('manual'),
})

export type BookmarkCreateInput = z.infer<typeof bookmarkCreateSchema>
export type BookmarkUpdateInput = z.infer<typeof bookmarkUpdateSchema>
export type BookmarkMoveInput = z.infer<typeof bookmarkMoveSchema>
export type BookmarkQueryInput = z.infer<typeof bookmarkQuerySchema>
