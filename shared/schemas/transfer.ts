import { z } from 'zod'

export const transferSections = ['sources', 'subfeeds', 'feeds', 'bookmarks', 'tags', 'settings'] as const
export const transferSelectionSchema = z.object(Object.fromEntries(transferSections.map((section) => [section, z.boolean()])) as Record<(typeof transferSections)[number], z.ZodBoolean>).strict()
export const transferModeSchema = z.enum(['merge', 'replace'])
const date = z.string().datetime({ offset: true }).nullable()
const optionalDate = z.string().datetime({ offset: true }).nullable()
const json = z.unknown()
export const transferDocumentSchema = z.object({
  app: z.literal('Knowbook'), format: z.literal('knowbook-backup'), version: z.literal(1), exportedAt: z.string().datetime({ offset: true }),
  sources: z.array(z.object({ id: z.number().int(), url: z.string(), title: z.string(), managed: z.boolean(), pagination: json.nullable(), queryParams: json.nullable(), createdAt: date, updatedAt: date, lastVisitedAt: optionalDate, tagIds: z.array(z.number().int()) })),
  subfeeds: z.array(z.object({ id: z.number().int(), sourceId: z.number().int(), name: z.string(), queryParams: json.nullable(), createdAt: date, updatedAt: date, lastVisitedAt: optionalDate })),
  feeds: z.array(z.object({ id: z.number().int(), name: z.string(), createdAt: date, updatedAt: date, lastVisitedAt: optionalDate })),
  feedSources: z.array(z.object({ feedId: z.number().int(), sourceId: z.number().int(), subfeedId: z.number().int().nullable() })),
  items: z.array(z.object({ id: z.number().int(), sourceId: z.number().int(), guid: z.string(), title: z.string(), description: z.string().nullable(), link: z.string().nullable(), publishedAt: date, tags: z.array(z.string()).nullable(), imageUrl: z.string().nullable(), fetchedAt: date, subfeedIds: z.array(z.number().int()) })),
  bookmarks: z.array(z.object({ id: z.number().int(), itemId: z.number().int(), sortOrder: z.number().int(), tags: z.array(z.string()).nullable(), createdAt: date })),
  tags: z.array(z.object({ id: z.number().int(), name: z.string() })),
  settings: z.array(z.object({ key: z.string(), value: json })),
}).strict()
export const transferRequestSchema = z.object({ document: transferDocumentSchema, selection: transferSelectionSchema, mode: transferModeSchema, acknowledgeOverwrite: z.boolean().optional() }).strict()
export type TransferDocument = z.infer<typeof transferDocumentSchema>
export type TransferSelection = z.infer<typeof transferSelectionSchema>
export type TransferMode = z.infer<typeof transferModeSchema>
