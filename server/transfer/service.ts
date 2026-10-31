import { and, eq } from 'drizzle-orm'
import { createHash, randomBytes } from 'node:crypto'
import { db as defaultDb, type DB } from '../db/client'
import { bookmarks, feedSources, feeds, itemSubfeeds, items, settings, sourceTags, sources, subfeeds, tags } from '../db/schema'
import { transferDocumentSchema, transferRequestSchema, transferSections, type TransferDocument, type TransferSelection } from '#shared/schemas/transfer'
import { appSettingsSchema } from '#shared/schemas/settings'

const asIso = (value: Date | null | undefined) => value ? value.toISOString() : null
export function exportDocument(database: DB = defaultDb, now = new Date()): TransferDocument {
  const sourceRows = database.select().from(sources).all()
  const subfeedRows = database.select().from(subfeeds).all()
  const feedRows = database.select().from(feeds).all()
  const itemRows = database.select().from(items).all()
  const document = {
    app: 'Knowbook' as const, format: 'knowbook-backup' as const, version: 1 as const, exportedAt: now.toISOString(),
    sources: sourceRows.map((row) => ({ ...row, pagination: row.pagination ?? null, queryParams: row.queryParams ?? null, createdAt: asIso(row.createdAt)!, updatedAt: asIso(row.updatedAt)!, lastVisitedAt: asIso(row.lastVisitedAt), tagIds: database.select().from(sourceTags).all().filter((rel) => rel.sourceId === row.id).map((rel) => rel.tagId) })),
    subfeeds: subfeedRows.map((row) => ({ ...row, queryParams: row.queryParams ?? null, createdAt: asIso(row.createdAt)!, updatedAt: asIso(row.updatedAt)!, lastVisitedAt: asIso(row.lastVisitedAt) })),
    feeds: feedRows.map((row) => ({ ...row, createdAt: asIso(row.createdAt)!, updatedAt: asIso(row.updatedAt)!, lastVisitedAt: asIso(row.lastVisitedAt) })),
    feedSources: database.select().from(feedSources).all().map(({ feedId, sourceId, subfeedId }) => ({ feedId, sourceId, subfeedId })),
    items: itemRows.map((row) => ({ ...row, publishedAt: asIso(row.publishedAt), fetchedAt: asIso(row.fetchedAt)!, subfeedIds: database.select().from(itemSubfeeds).all().filter((rel) => rel.itemId === row.id).map((rel) => rel.subfeedId) })),
    bookmarks: database.select().from(bookmarks).all().map((row) => ({ ...row, createdAt: asIso(row.createdAt)!, tags: row.tags ?? null })),
    tags: database.select().from(tags).all(), settings: database.select().from(settings).all(),
  }
  return transferDocumentSchema.parse(document)
}

const active = new Map<string, { expires: number; request: ReturnType<typeof transferRequestSchema.parse>; fingerprint: string; result?: unknown }>()
export const transferMaxBytes = Number(process.env.TRANSFER_MAX_BYTES) > 0 ? Number(process.env.TRANSFER_MAX_BYTES) : 50 * 1024 * 1024
function fingerprint(document: TransferDocument) { return createHash('sha256').update(JSON.stringify({ ...document, exportedAt: '' })).digest('hex') }
function dependencies(doc: TransferDocument, selected: TransferSelection) {
  const required = new Set<string>()
  if (!selected.sources && selected.subfeeds && doc.subfeeds.length) required.add('sources')
  if (!selected.sources && selected.feeds && doc.feedSources.length) required.add('sources')
  if (!selected.sources && selected.bookmarks && doc.bookmarks.length) required.add('sources')
  if (!selected.subfeeds && doc.feedSources.some((r) => r.subfeedId !== null)) required.add('subfeeds')
  if (!selected.tags && selected.sources && doc.sources.some((s) => s.tagIds.length)) required.add('tags')
  return [...required]
}
export function previewImport(raw: unknown, database: DB = defaultDb, receiverSnapshot?: TransferDocument) {
  const parsed = transferRequestSchema.safeParse(raw)
  if (!parsed.success) throw Object.assign(new Error('Invalid Knowbook backup file'), { statusCode: 400 })
  if (!transferSections.some((section) => parsed.data.selection[section])) throw Object.assign(new Error('Select at least one section to import'), { statusCode: 400 })
  const doc = parsed.data.document
  const sourceIds = new Set(doc.sources.map((row) => row.id))
  const subfeedIds = new Set(doc.subfeeds.map((row) => row.id))
  const feedIds = new Set(doc.feeds.map((row) => row.id))
  const itemIds = new Set(doc.items.map((row) => row.id))
  const tagIds = new Set(doc.tags.map((row) => row.id))
  if (doc.subfeeds.some((row) => !sourceIds.has(row.sourceId)) || doc.feedSources.some((row) => !feedIds.has(row.feedId) || !sourceIds.has(row.sourceId) || (row.subfeedId !== null && !subfeedIds.has(row.subfeedId))) || doc.items.some((row) => !sourceIds.has(row.sourceId) || row.subfeedIds.some((id) => !subfeedIds.has(id))) || doc.bookmarks.some((row) => !itemIds.has(row.itemId)) || doc.sources.some((row) => row.tagIds.some((id) => !tagIds.has(id))) || doc.items.some((item) => item.subfeedIds.some((id) => doc.subfeeds.find((subfeed) => subfeed.id === id)?.sourceId !== item.sourceId)) || doc.feedSources.some((row) => row.subfeedId !== null && doc.subfeeds.find((subfeed) => subfeed.id === row.subfeedId)?.sourceId !== row.sourceId)) {
    throw Object.assign(new Error('Backup contains invalid or mismatched record references'), { statusCode: 400 })
  }
  const knownSettings = Object.fromEntries(doc.settings.filter((row) => ['pageSize', 'searchMaxPages', 'theme', 'editorialColumnRatio', 'autoRefreshThresholdMinutes'].includes(row.key)).map((row) => [row.key, row.value]))
  for (const [key, value] of Object.entries(knownSettings)) {
    const valid = appSettingsSchema.shape[key as keyof typeof appSettingsSchema.shape].safeParse(value)
    if (!valid.success) throw Object.assign(new Error(`Backup contains an invalid value for setting "${key}"`), { statusCode: 400 })
  }
  const required = dependencies(parsed.data.document, parsed.data.selection)
  if (parsed.data.mode === 'merge') {
    const dupSource = new Set<string>()
    const existingSources = database.select().from(sources).all()
    for (const row of doc.sources) {
      if (existingSources.filter((existing) => existing.url === row.url).length > 1 || dupSource.has(row.url)) throw Object.assign(new Error(`Source URL "${row.url}" is ambiguous. Resolve duplicate identities before merging.`), { statusCode: 409 })
      dupSource.add(row.url)
    }
    const duplicateNames = (incoming: string[], existing: string[], kind: string) => {
      if (incoming.some((name, index) => incoming.indexOf(name) !== index) || incoming.some((name) => existing.filter((value) => value === name).length > 1)) throw Object.assign(new Error(`Some ${kind} names are ambiguous. Resolve duplicate identities before merging.`), { statusCode: 409 })
    }
    duplicateNames(doc.tags.map((row) => row.name), database.select().from(tags).all().map((row) => row.name), 'tag')
    duplicateNames(doc.feeds.map((row) => row.name), database.select().from(feeds).all().map((row) => row.name), 'feed')
    for (const source of doc.sources) {
      const matches = doc.subfeeds.filter((row) => row.sourceId === source.id).map((row) => row.name)
      const destination = existingSources.find((row) => row.url === source.url)
      if (destination) duplicateNames(matches, database.select().from(subfeeds).all().filter((row) => row.sourceId === destination.id).map((row) => row.name), 'subfeed')
    }
  }
  if (parsed.data.mode === 'replace') {
    const receiverSources = database.select().from(sources).all().map((row) => row.id)
    const receiverSubfeeds = database.select().from(subfeeds).all().map((row) => row.id)
    const receiverItems = database.select().from(items).all().map((row) => row.id)
    if (parsed.data.selection.sources) {
      if (!parsed.data.selection.subfeeds && database.select().from(subfeeds).all().some((row) => receiverSources.includes(row.sourceId))) required.push('subfeeds')
      if (!parsed.data.selection.feeds && database.select().from(feedSources).all().some((row) => receiverSources.includes(row.sourceId))) required.push('feeds')
      if (!parsed.data.selection.bookmarks && database.select().from(bookmarks).all().some((row) => receiverItems.includes(row.itemId))) required.push('bookmarks')
    }
    if (parsed.data.selection.subfeeds && !parsed.data.selection.feeds && database.select().from(feedSources).all().some((row) => row.subfeedId !== null && receiverSubfeeds.includes(row.subfeedId))) required.push('feeds')
    if (parsed.data.selection.tags && !parsed.data.selection.sources && database.select().from(sourceTags).all().length) required.push('sources')
  }
  const uniqueRequired = [...new Set(required)]
  if (uniqueRequired.length) throw Object.assign(new Error(`Select required sections: ${uniqueRequired.join(', ')}`), { statusCode: 400, data: { required: uniqueRequired } })
  const receiver = receiverSnapshot ?? exportDocument(database)
  const overwrite = parsed.data.mode === 'merge' ? {
    sources: doc.sources.filter((incoming) => { const existing = receiver.sources.find((row) => row.url === incoming.url); return existing && JSON.stringify([existing.title, existing.pagination, existing.queryParams]) !== JSON.stringify([incoming.title, incoming.pagination, incoming.queryParams]) }).length,
    subfeeds: doc.subfeeds.filter((incoming) => { const source = doc.sources.find((row) => row.id === incoming.sourceId); const dest = source && receiver.sources.find((row) => row.url === source.url); const existing = dest && receiver.subfeeds.find((row) => row.sourceId === dest.id && row.name === incoming.name); return existing && JSON.stringify([existing.queryParams, existing.lastVisitedAt]) !== JSON.stringify([incoming.queryParams, incoming.lastVisitedAt]) }).length,
    feeds: doc.feeds.filter((incoming) => { const existing = receiver.feeds.find((row) => row.name === incoming.name); return existing && existing.lastVisitedAt !== incoming.lastVisitedAt }).length,
    articles: doc.items.filter((incoming) => { const source = doc.sources.find((row) => row.id === incoming.sourceId); const dest = source && receiver.sources.find((row) => row.url === source.url); const existing = dest && receiver.items.find((row) => row.sourceId === dest.id && row.guid === incoming.guid); return existing && JSON.stringify([existing.title, existing.description, existing.link, existing.publishedAt, existing.tags, existing.imageUrl]) !== JSON.stringify([incoming.title, incoming.description, incoming.link, incoming.publishedAt, incoming.tags, incoming.imageUrl]) }).length,
    bookmarks: doc.bookmarks.filter((incoming) => { const article = doc.items.find((row) => row.id === incoming.itemId); const source = article && doc.sources.find((row) => row.id === article.sourceId); const dest = source && receiver.sources.find((row) => row.url === source.url); const item = article && dest && receiver.items.find((row) => row.sourceId === dest.id && row.guid === article.guid); const existing = item && receiver.bookmarks.find((row) => row.itemId === item.id); return existing && JSON.stringify([existing.tags, existing.createdAt]) !== JSON.stringify([incoming.tags, incoming.createdAt]) }).length,
    tags: 0,
    settings: doc.settings.filter((incoming) => receiver.settings.some((existing) => existing.key === incoming.key && JSON.stringify(existing.value) !== JSON.stringify(incoming.value))).length,
  } : { sources: 0, subfeeds: 0, feeds: 0, articles: 0, bookmarks: 0, tags: 0, settings: 0 }
  return { counts: { sources: parsed.data.document.sources.length, cachedArticles: parsed.data.document.items.length, subfeeds: parsed.data.document.subfeeds.length, feeds: parsed.data.document.feeds.length, bookmarks: parsed.data.document.bookmarks.length, tags: parsed.data.document.tags.length, settings: parsed.data.document.settings.length }, overwrite, hasOverwrite: Object.values(overwrite).some(Boolean), required: uniqueRequired, receiverFingerprint: fingerprint(receiver) }
}

export function prepareImport(raw: unknown, database: DB = defaultDb, now = Date.now()) {
  const parsed = transferRequestSchema.parse(raw)
  const snapshot = exportDocument(database)
  const preview = previewImport(raw, database, snapshot)
  if (parsed.mode === 'merge' && preview.hasOverwrite && !parsed.acknowledgeOverwrite) throw Object.assign(new Error('Acknowledge the overwrite warning before importing'), { statusCode: 400 })
  for (const [key, operation] of active) if (operation.expires <= now) active.delete(key)
  while (active.size >= 2) active.delete(active.keys().next().value!)
  const token = randomBytes(24).toString('base64url')
  active.set(token, { expires: now + 10 * 60_000, request: parsed, fingerprint: preview.receiverFingerprint })
  return { token, backup: parsed.mode === 'replace' ? snapshot : undefined, backupFilename: parsed.mode === 'replace' ? fileName('backup') : undefined }
}
export const fileName = (kind: 'export' | 'backup', now = new Date()) => `knowbook-${kind}-${now.toISOString().replace(/[-:]/g, '')}.json`

function applyImport(req: ReturnType<typeof transferRequestSchema.parse>, database: DB) {
  const doc = req.document, selection = req.selection
  const sourceMap = new Map<number, number>(), subfeedMap = new Map<number, number>(), feedMap = new Map<number, number>(), tagMap = new Map<number, number>(), itemMap = new Map<number, number>()
  // Replace is dependency checked by preview; delete children before parents.
  if (req.mode === 'replace') {
    if (selection.bookmarks) database.delete(bookmarks).run()
    if (selection.feeds) { database.delete(feedSources).run(); database.delete(feeds).run() }
    if (selection.subfeeds) { database.delete(itemSubfeeds).run(); database.delete(subfeeds).run() }
    if (selection.sources) { database.delete(sourceTags).run(); database.delete(items).run(); database.delete(sources).run() }
    if (selection.tags) database.delete(tags).run()
    if (selection.settings) database.delete(settings).run()
  }
  for (const tag of doc.tags) {
    if (!selection.tags && req.mode === 'replace') continue
    const existing = req.mode === 'merge' ? database.select().from(tags).where(eq(tags.name, tag.name)).get() : undefined
    const row = existing ?? database.insert(tags).values({ name: tag.name }).returning().get()!
    tagMap.set(tag.id, row.id)
  }
  for (const source of doc.sources) {
    if (!selection.sources) continue
    const existing = req.mode === 'merge' ? database.select().from(sources).where(eq(sources.url, source.url)).get() : undefined
    const values = { url: source.url, title: source.title, managed: existing?.managed ?? false, pagination: source.pagination as never, queryParams: source.queryParams as never, createdAt: new Date(source.createdAt), updatedAt: new Date(source.updatedAt), lastVisitedAt: source.lastVisitedAt ? new Date(source.lastVisitedAt) : null }
    const row = existing ? (database.update(sources).set(values).where(eq(sources.id, existing.id)).returning().get()!) : database.insert(sources).values(values).returning().get()!
    sourceMap.set(source.id, row.id)
    for (const tagId of source.tagIds) { const mapped = tagMap.get(tagId); if (mapped) database.insert(sourceTags).values({ sourceId: row.id, tagId: mapped }).onConflictDoNothing().run() }
  }
  for (const subfeed of doc.subfeeds) {
    if (!selection.subfeeds) continue
    const sourceId = sourceMap.get(subfeed.sourceId) ?? (req.mode === 'merge' ? subfeed.sourceId : undefined); if (!sourceId) continue
    const existing = req.mode === 'merge' ? database.select().from(subfeeds).where(and(eq(subfeeds.sourceId, sourceId), eq(subfeeds.name, subfeed.name))).get() : undefined
    const values = { sourceId, name: subfeed.name, queryParams: subfeed.queryParams as never, createdAt: new Date(subfeed.createdAt), updatedAt: new Date(subfeed.updatedAt), lastVisitedAt: subfeed.lastVisitedAt ? new Date(subfeed.lastVisitedAt) : null }
    const row = existing ? database.update(subfeeds).set(values).where(eq(subfeeds.id, existing.id)).returning().get()! : database.insert(subfeeds).values(values).returning().get()!
    subfeedMap.set(subfeed.id, row.id)
  }
  for (const feed of doc.feeds) {
    if (!selection.feeds) continue
    const existing = req.mode === 'merge' ? database.select().from(feeds).where(eq(feeds.name, feed.name)).get() : undefined
    const values = { name: feed.name, createdAt: new Date(feed.createdAt), updatedAt: new Date(feed.updatedAt), lastVisitedAt: feed.lastVisitedAt ? new Date(feed.lastVisitedAt) : null }
    const row = existing ? database.update(feeds).set(values).where(eq(feeds.id, existing.id)).returning().get()! : database.insert(feeds).values(values).returning().get()!
    feedMap.set(feed.id, row.id)
  }
  for (const item of doc.items) {
    if (!selection.sources) continue
    const sourceId = sourceMap.get(item.sourceId); if (!sourceId) continue
    const existing = req.mode === 'merge' ? database.select().from(items).where(and(eq(items.sourceId, sourceId), eq(items.guid, item.guid))).get() : undefined
    const values = { sourceId, guid: item.guid, title: item.title, description: item.description, link: item.link, publishedAt: item.publishedAt ? new Date(item.publishedAt) : null, tags: item.tags, imageUrl: item.imageUrl, fetchedAt: new Date(item.fetchedAt) }
    const row = existing ? database.update(items).set(values).where(eq(items.id, existing.id)).returning().get()! : database.insert(items).values(values).returning().get()!
    itemMap.set(item.id, row.id)
    if (selection.subfeeds) for (const id of item.subfeedIds) { const mapped = subfeedMap.get(id); if (mapped) database.insert(itemSubfeeds).values({ itemId: row.id, subfeedId: mapped }).onConflictDoNothing().run() }
  }
  if (selection.feeds) for (const rel of doc.feedSources) {
    const feedId = feedMap.get(rel.feedId), sourceId = sourceMap.get(rel.sourceId), subfeedId = rel.subfeedId === null ? null : subfeedMap.get(rel.subfeedId)
    if (feedId && sourceId && (rel.subfeedId === null || subfeedId)) database.insert(feedSources).values({ feedId, sourceId, subfeedId: subfeedId ?? null }).onConflictDoNothing().run()
  }
  if (selection.bookmarks) for (const mark of [...doc.bookmarks].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const itemId = itemMap.get(mark.itemId) ?? (req.mode === 'merge' ? mark.itemId : undefined); if (!itemId) continue
    const existing = req.mode === 'merge' ? database.select().from(bookmarks).where(eq(bookmarks.itemId, itemId)).get() : undefined
    const values = { itemId, tags: mark.tags, createdAt: new Date(mark.createdAt), sortOrder: existing?.sortOrder ?? mark.sortOrder }
    if (existing) database.update(bookmarks).set({ tags: values.tags, createdAt: values.createdAt }).where(eq(bookmarks.id, existing.id)).run()
    else database.insert(bookmarks).values(values).run()
  }
  if (selection.settings) for (const setting of doc.settings) database.insert(settings).values(setting as never).onConflictDoUpdate({ target: settings.key, set: { value: setting.value as never } }).run()
}

type SectionResult = { created: number; updated: number; unchanged: number; removed: number }
const emptyResult = (): SectionResult => ({ created: 0, updated: 0, unchanged: 0, removed: 0 })
function compareSection<T>(incoming: T[], receiver: T[], key: (row: T) => string, value: (row: T) => unknown, replace: boolean): SectionResult {
  const result = emptyResult()
  const old = new Map(receiver.map((row) => [key(row), row]))
  const incomingKeys = new Set<string>()
  for (const row of incoming) {
    const identity = key(row), existing = old.get(identity)
    incomingKeys.add(identity)
    if (!existing) result.created++
    else if (JSON.stringify(value(existing)) === JSON.stringify(value(row))) result.unchanged++
    else result.updated++
  }
  if (replace) result.removed = receiver.filter((row) => !incomingKeys.has(key(row))).length
  return result
}
function importResults(request: ReturnType<typeof transferRequestSchema.parse>, receiver: TransferDocument) {
  const { document, selection, mode } = request
  const result: Record<string, SectionResult> = {}
  const replace = mode === 'replace'
  const sourceUrl = (id: number, doc: TransferDocument) => doc.sources.find((row) => row.id === id)?.url ?? `missing:${id}`
  for (const section of transferSections) {
    if (!selection[section]) { result[section] = emptyResult(); continue }
    if (section === 'sources') {
      const incoming = [...document.sources.map((row) => ({ key: `source:${row.url}`, value: [row.title, row.pagination, row.queryParams, row.createdAt, row.updatedAt, row.lastVisitedAt] })), ...document.items.map((row) => ({ key: `item:${sourceUrl(row.sourceId, document)}:${row.guid}`, value: [row.title, row.description, row.link, row.publishedAt, row.tags, row.imageUrl, row.fetchedAt] }))]
      const old = [...receiver.sources.map((row) => ({ key: `source:${row.url}`, value: [row.title, row.pagination, row.queryParams, row.createdAt, row.updatedAt, row.lastVisitedAt] })), ...receiver.items.map((row) => ({ key: `item:${sourceUrl(row.sourceId, receiver)}:${row.guid}`, value: [row.title, row.description, row.link, row.publishedAt, row.tags, row.imageUrl, row.fetchedAt] }))]
      result[section] = compareSection(incoming, old, (row) => row.key, (row) => row.value, replace)
    } else if (section === 'subfeeds') {
      const rows = (doc: TransferDocument) => doc.subfeeds.map((row) => ({ key: `${sourceUrl(row.sourceId, doc)}:${row.name}`, value: [row.queryParams, row.createdAt, row.updatedAt, row.lastVisitedAt] }))
      result[section] = compareSection(rows(document), rows(receiver), (row) => row.key, (row) => row.value, replace)
    } else if (section === 'feeds') {
      const rows = (doc: TransferDocument) => doc.feeds.map((row) => ({ key: row.name, value: [row.createdAt, row.updatedAt, row.lastVisitedAt] }))
      result[section] = compareSection(rows(document), rows(receiver), (row) => row.key, (row) => row.value, replace)
    } else if (section === 'bookmarks') {
      const rows = (doc: TransferDocument) => doc.bookmarks.map((row) => { const item = doc.items.find((candidate) => candidate.id === row.itemId); return { key: `${item ? sourceUrl(item.sourceId, doc) : 'missing'}:${item?.guid ?? row.itemId}`, value: [row.tags, row.createdAt, row.sortOrder] } })
      result[section] = compareSection(rows(document), rows(receiver), (row) => row.key, (row) => row.value, replace)
    } else if (section === 'tags') {
      result[section] = compareSection(document.tags, receiver.tags, (row) => row.name, (row) => row.name, replace)
    } else {
      result[section] = compareSection(document.settings, receiver.settings, (row) => row.key, (row) => row.value, replace)
    }
  }
  return result
}

export function commitImport(token: string, database: DB = defaultDb, now = Date.now()) {
  const prepared = active.get(token)
  if (!prepared || prepared.expires < now) { active.delete(token); throw Object.assign(new Error('Import preparation expired. Preview and prepare again.'), { statusCode: 410 }) }
  if (prepared.result) return prepared.result
  let results: Record<string, SectionResult> = {}
  database.transaction((tx) => {
    const receiver = exportDocument(tx)
    if (prepared.request.mode === 'replace' && fingerprint(receiver) !== prepared.fingerprint) throw Object.assign(new Error('Data changed after backup preparation. Prepare a fresh backup.'), { statusCode: 409 })
    results = importResults(prepared.request, receiver)
    applyImport(prepared.request, tx)
  })
  prepared.result = { sections: results }
  return prepared.result
}
