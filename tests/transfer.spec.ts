import { describe, expect, it } from 'vitest'
import { createTestDb } from './db/helpers'
import { bookmarks, items, settings, sourceTags, sources, tags } from '~~/server/db/schema'
import { commitImport, exportDocument, prepareImport, previewImport } from '~~/server/transfer/service'
import { transferSections } from '#shared/schemas/transfer'

describe('backup transfer', () => {
  it('round trips source tags, cached articles, bookmarks and settings with remapped IDs', () => {
    const origin = createTestDb()
    const tag = origin.insert(tags).values({ name: 'read' }).returning().get()
    const source = origin.insert(sources).values({ url: 'https://example.test/feed', title: 'Example' }).returning().get()
    origin.insert(sourceTags).values({ sourceId: source.id, tagId: tag.id }).run()
    const item = origin.insert(items).values({ sourceId: source.id, guid: 'guid-1', title: 'Article', description: 'Body', link: 'https://example.test/a', tags: ['inline'], imageUrl: 'https://example.test/image.png' }).returning().get()
    origin.insert(bookmarks).values({ itemId: item.id, sortOrder: 7, tags: ['favorite'] }).run()
    origin.insert(settings).values({ key: 'unused-setting', value: { nested: true } }).run()
    const document = exportDocument(origin)
    expect(document.format).toBe('knowbook-backup')
    expect(document.items[0]?.tags).toEqual(['inline'])
    expect(document.sources[0]?.tagIds).toEqual([tag.id])

    const destination = createTestDb()
    destination.insert(sources).values({ url: 'https://different.test', title: 'Destination' }).run()
    const selection = Object.fromEntries(transferSections.map((section) => [section, true])) as Record<(typeof transferSections)[number], boolean>
    const request = { document, selection, mode: 'replace' as const }
    expect(previewImport(request, destination).counts.cachedArticles).toBe(1)
    const prepared = prepareImport(request, destination)
    expect(prepared.backup?.app).toBe('Knowbook')
    expect(prepared.backup?.sources[0]?.url).toBe('https://different.test')
    expect(prepared.backupFilename).toMatch(/^knowbook-backup-\d{8}T\d{6}\.\d{3}Z\.json$/)
    const { token } = prepared
    const outcome = commitImport(token, destination) as { sections: Record<string, { created: number; updated: number; unchanged: number; removed: number }> }
    expect(outcome.sections.sources?.created).toBe(2)
    const restored = exportDocument(destination)
    expect(restored.sources.map((row) => row.url)).toContain(source.url)
    expect(restored.sources.find((row) => row.url === source.url)?.id).not.toBe(source.id)
    expect(restored.items[0]).toMatchObject({ guid: 'guid-1', description: 'Body', imageUrl: 'https://example.test/image.png', tags: ['inline'] })
    expect(restored.bookmarks[0]).toMatchObject({ sortOrder: 7, tags: ['favorite'] })
    expect(restored.settings).toEqual([{ key: 'unused-setting', value: { nested: true } }])
    origin.$client.close(); destination.$client.close()
  })

  it('requires acknowledgement before preparing an overwrite merge', () => {
    const database = createTestDb()
    database.insert(settings).values({ key: 'theme', value: 'light' }).run()
    const document = exportDocument(database)
    document.settings[0]!.value = 'dark'
    const request = { document, selection: { sources: false, subfeeds: false, feeds: false, bookmarks: false, tags: false, settings: true }, mode: 'merge' as const }
    expect(previewImport(request, database).hasOverwrite).toBe(true)
    expect(() => prepareImport(request, database)).toThrow(/Acknowledge/)
    database.$client.close()
  })

  it('keeps repeated merges idempotent and rejects a replace that would cascade into unchecked bookmarks', () => {
    const origin = createTestDb()
    const source = origin.insert(sources).values({ url: 'https://repeat.test/feed', title: 'Repeat' }).returning().get()
    const item = origin.insert(items).values({ sourceId: source.id, guid: 'same', title: 'Same' }).returning().get()
    origin.insert(bookmarks).values({ itemId: item.id }).run()
    const document = exportDocument(origin)
    const destination = createTestDb()
    const selection = Object.fromEntries(transferSections.map((section) => [section, true])) as Record<(typeof transferSections)[number], boolean>
    const request = { document, selection, mode: 'merge' as const, acknowledgeOverwrite: true }
    commitImport(prepareImport(request, destination).token, destination)
    const second = commitImport(prepareImport(request, destination).token, destination) as { sections: Record<string, { created: number }> }
    expect(second.sections.sources?.created).toBe(0)
    expect(destination.select().from(bookmarks).all()).toHaveLength(1)

    const incomplete = { document, selection: { ...selection, bookmarks: false }, mode: 'replace' as const }
    expect(() => previewImport(incomplete, destination)).toThrow(/bookmarks/)
    origin.$client.close(); destination.$client.close()
  })

  it('expires prepared operations and detects receiver changes before replace commit', () => {
    const database = createTestDb()
    const document = exportDocument(database)
    const selection = Object.fromEntries(transferSections.map((section) => [section, true])) as Record<(typeof transferSections)[number], boolean>
    const expired = prepareImport({ document, selection, mode: 'merge' }, database, 100)
    expect(() => commitImport(expired.token, database, 100 + 10 * 60_000 + 1)).toThrow(/expired/i)
    const prepared = prepareImport({ document, selection, mode: 'replace' }, database)
    database.insert(settings).values({ key: 'concurrent', value: true }).run()
    expect(() => commitImport(prepared.token, database)).toThrow(/changed after backup/i)
    database.$client.close()
  })
})
