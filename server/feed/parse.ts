import { XMLParser } from 'fast-xml-parser'
import type { ItemTags, NewItem } from '#shared/types'
import { FeedParseError } from './errors'

export type ParsedItem = Pick<
  NewItem,
  'guid' | 'title' | 'description' | 'link' | 'publishedAt' | 'tags'
>

const ARRAY_TAGS = new Set(['item', 'entry', 'category', 'link'])

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (tagName) => ARRAY_TAGS.has(tagName),
})

// Node shapes are loosely typed: fast-xml-parser produces strings, objects
// with a `#text` key, or attribute-bearing objects, depending on the source
// feed's structure. We only read the handful of fields we care about.
type XmlNode = string | number | Record<string, unknown> | undefined

function textOf(node: XmlNode): string | undefined {
  if (node == null) return undefined
  if (typeof node === 'string') return node.trim() || undefined
  if (typeof node === 'number') return String(node)
  const text = (node as Record<string, unknown>)['#text']
  return typeof text === 'string' ? text.trim() || undefined : undefined
}

function toDate(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

// RSS's single <link> is forced into an array by ARRAY_TAGS (shared with
// Atom's potentially-multiple <link>s), so take the first entry's text.
function firstText(node: XmlNode | XmlNode[]): string | undefined {
  const [first] = asArray(node)
  return textOf(first)
}

function mapRssItem(item: Record<string, unknown>): ParsedItem | undefined {
  const link = firstText(item.link as XmlNode | XmlNode[])
  const guid = textOf(item.guid as XmlNode) ?? link
  if (!guid && !link) return undefined

  const tags = asArray(item.category as XmlNode | XmlNode[])
    .map((c) => textOf(c))
    .filter((t): t is string => !!t)

  return {
    guid: guid ?? link!,
    title: textOf(item.title as XmlNode) ?? '(untitled)',
    description: textOf(item.description as XmlNode) ?? null,
    link: link ?? null,
    publishedAt:
      toDate(
        textOf(item.pubDate as XmlNode) ?? textOf(item['dc:date'] as XmlNode),
      ) ?? null,
    tags: tags.length ? (tags as ItemTags) : null,
  }
}

function atomLinkHref(links: Record<string, unknown>[]): string | undefined {
  const alternate = links.find((l) => l['@_rel'] === 'alternate' || !l['@_rel'])
  return textOf((alternate ?? links[0])?.['@_href'] as XmlNode)
}

function mapAtomEntry(entry: Record<string, unknown>): ParsedItem | undefined {
  const links = asArray(entry.link as XmlNode | XmlNode[]).filter(
    (l): l is Record<string, unknown> => typeof l === 'object' && l != null,
  )
  const link = atomLinkHref(links)
  const guid = textOf(entry.id as XmlNode) ?? link
  if (!guid && !link) return undefined

  const tags = asArray(entry.category as XmlNode | XmlNode[])
    .map((c) =>
      typeof c === 'object' && c != null
        ? textOf((c as Record<string, unknown>)['@_term'] as XmlNode)
        : undefined,
    )
    .filter((t): t is string => !!t)

  return {
    guid: guid ?? link!,
    title: textOf(entry.title as XmlNode) ?? '(untitled)',
    description:
      textOf(entry.summary as XmlNode) ??
      textOf(entry.content as XmlNode) ??
      null,
    link: link ?? null,
    publishedAt:
      toDate(
        textOf(entry.published as XmlNode) ?? textOf(entry.updated as XmlNode),
      ) ?? null,
    tags: tags.length ? (tags as ItemTags) : null,
  }
}

export function parseFeed(body: string): ParsedItem[] {
  let doc: Record<string, unknown>
  try {
    doc = xmlParser.parse(body) as Record<string, unknown>
  } catch (cause) {
    throw new FeedParseError('Failed to parse feed XML', cause)
  }

  if (doc.rss) {
    const rss = doc.rss as Record<string, unknown>
    const channel = (
      Array.isArray(rss.channel) ? rss.channel[0] : rss.channel
    ) as Record<string, unknown> | undefined
    const items = asArray(channel?.item as XmlNode | XmlNode[]).filter(
      (i): i is Record<string, unknown> => typeof i === 'object' && i != null,
    )
    return items.map(mapRssItem).filter((i): i is ParsedItem => !!i)
  }

  if (doc['rdf:RDF']) {
    const rdf = doc['rdf:RDF'] as Record<string, unknown>
    const items = asArray(rdf.item as XmlNode | XmlNode[]).filter(
      (i): i is Record<string, unknown> => typeof i === 'object' && i != null,
    )
    return items.map(mapRssItem).filter((i): i is ParsedItem => !!i)
  }

  if (doc.feed) {
    const feed = doc.feed as Record<string, unknown>
    const entries = asArray(feed.entry as XmlNode | XmlNode[]).filter(
      (e): e is Record<string, unknown> => typeof e === 'object' && e != null,
    )
    return entries.map(mapAtomEntry).filter((i): i is ParsedItem => !!i)
  }

  throw new FeedParseError('Unrecognised feed format: no rss/rdf:RDF/feed root')
}
