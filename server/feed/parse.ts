import { XMLParser } from 'fast-xml-parser'
import type { ItemTags, NewItem } from '#shared/types'
import { FeedParseError } from './errors'

export type ParsedItem = Pick<
  NewItem,
  | 'guid'
  | 'title'
  | 'description'
  | 'link'
  | 'publishedAt'
  | 'tags'
  | 'imageUrl'
>

// `enclosure` and `media:content` can both repeat on a single item.
const ARRAY_TAGS = new Set([
  'item',
  'entry',
  'category',
  'link',
  'enclosure',
  'media:content',
])

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

// Drops non-object entries (e.g. self-closing tags that parsed to `''`)
// rather than throwing on them.
function asObjects(node: XmlNode | XmlNode[]): Record<string, unknown>[] {
  return asArray(node).filter(
    (n): n is Record<string, unknown> => typeof n === 'object' && n != null,
  )
}

function attr(
  node: Record<string, unknown> | undefined,
  name: string,
): string | undefined {
  const value = node?.[`@_${name}`]
  return typeof value === 'string' ? value : undefined
}

// Accepts only an absolute http(s) URL — rejects relative paths and other
// schemes (`data:` included) — so the view layer can render `imageUrl`
// without re-validating it.
function isHttpUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : null
  } catch {
    return null
  }
}

// Item image extraction: several competing feed conventions, tried in order
// and stopping at the first usable absolute http(s) URL. `atomLinks` is the
// `links` array `mapAtomEntry` already builds — Atom entries also commonly
// carry `media:*`, so rungs 1-2 apply to them unchanged via `node`.
function itemImageUrl(
  node: Record<string, unknown>,
  atomLinks: Record<string, unknown>[] = [],
): string | null {
  return (
    mediaThumbnailUrl(node) ??
    mediaContentUrl(node) ??
    enclosureImageUrl(asObjects(node.enclosure as XmlNode | XmlNode[])) ??
    itunesImageUrl(node) ??
    atomEnclosureImageUrl(atomLinks) ??
    itemImageTagUrl(node)
  )
}

// 1. <media:thumbnail url="…"/> (Media RSS) — the only element actually
// meant for thumbnails.
function mediaThumbnailUrl(node: Record<string, unknown>): string | null {
  const [thumbnail] = asObjects(node['media:thumbnail'] as XmlNode | XmlNode[])
  return isHttpUrl(attr(thumbnail, 'url'))
}

function isImageMediaContent(node: Record<string, unknown>): boolean {
  return (
    attr(node, 'medium') === 'image' ||
    (attr(node, 'type') ?? '').startsWith('image/')
  )
}

// 2. <media:content url="…" medium="image" type="image/*"/> — may repeat and
// may sit inside <media:group>. Prefer isDefault="true", else the first
// image-typed entry.
function mediaContentUrl(node: Record<string, unknown>): string | null {
  const group = node['media:group'] as Record<string, unknown> | undefined
  const entries = [
    ...asObjects(node['media:content'] as XmlNode | XmlNode[]),
    ...asObjects(group?.['media:content'] as XmlNode | XmlNode[]),
  ]
  const preferred =
    entries.find(
      (e) => attr(e, 'isDefault') === 'true' && isImageMediaContent(e),
    ) ?? entries.find(isImageMediaContent)
  return isHttpUrl(attr(preferred, 'url'))
}

// 3. <enclosure url="…" type="image/jpeg" length="0"/> — RSS 2.0 core, and
// the telex.hu case. `length` is noise (the spec requires it; real feeds
// don't always send a meaningful one), and enclosures also carry podcast
// audio/video, so filter strictly on `type` starting `image/`.
function enclosureImageUrl(
  enclosures: Record<string, unknown>[],
): string | null {
  const image = enclosures.find((e) =>
    (attr(e, 'type') ?? '').startsWith('image/'),
  )
  return isHttpUrl(attr(image, 'url'))
}

// 4. <itunes:image href="…"/> — podcast feeds. Note `href`, not `url`.
function itunesImageUrl(node: Record<string, unknown>): string | null {
  const [image] = asObjects(node['itunes:image'] as XmlNode | XmlNode[])
  return isHttpUrl(attr(image, 'href'))
}

// 5. Atom <link rel="enclosure" type="image/*" href="…"/>.
function atomEnclosureImageUrl(
  links: Record<string, unknown>[],
): string | null {
  const image = links.find(
    (l) =>
      attr(l, 'rel') === 'enclosure' &&
      (attr(l, 'type') ?? '').startsWith('image/'),
  )
  return isHttpUrl(attr(image, 'href'))
}

// 6. <image><url>…</url></image> inside an item — non-standard (RSS 2.0
// defines <image> at channel level only) but present in the wild.
function itemImageTagUrl(node: Record<string, unknown>): string | null {
  const image = node.image as Record<string, unknown> | undefined
  return isHttpUrl(textOf(image?.url as XmlNode))
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
    imageUrl: itemImageUrl(item),
  }
}

function atomLinkHref(links: Record<string, unknown>[]): string | undefined {
  const alternate = links.find((l) => l['@_rel'] === 'alternate' || !l['@_rel'])
  return textOf((alternate ?? links[0])?.['@_href'] as XmlNode)
}

function mapAtomEntry(entry: Record<string, unknown>): ParsedItem | undefined {
  const links = asObjects(entry.link as XmlNode | XmlNode[])
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
    imageUrl: itemImageUrl(entry, links),
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
    const items = asObjects(channel?.item as XmlNode | XmlNode[])
    return items.map(mapRssItem).filter((i): i is ParsedItem => !!i)
  }

  if (doc['rdf:RDF']) {
    const rdf = doc['rdf:RDF'] as Record<string, unknown>
    const items = asObjects(rdf.item as XmlNode | XmlNode[])
    return items.map(mapRssItem).filter((i): i is ParsedItem => !!i)
  }

  if (doc.feed) {
    const feed = doc.feed as Record<string, unknown>
    const entries = asObjects(feed.entry as XmlNode | XmlNode[])
    return entries.map(mapAtomEntry).filter((i): i is ParsedItem => !!i)
  }

  throw new FeedParseError('Unrecognised feed format: no rss/rdf:RDF/feed root')
}
