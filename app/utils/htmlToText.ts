const ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  aacute: 'á',
  Aacute: 'Á',
  eacute: 'é',
  Eacute: 'É',
  iacute: 'í',
  Iacute: 'Í',
  oacute: 'ó',
  Oacute: 'Ó',
  uacute: 'ú',
  Uacute: 'Ú',
  ouml: 'ö',
  Ouml: 'Ö',
  uuml: 'ü',
  Uuml: 'Ü',
  odblac: 'ő',
  Odblac: 'Ő',
  udblac: 'ű',
  Udblac: 'Ű',
  agrave: 'à',
  egrave: 'è',
  iuml: 'ï',
  szlig: 'ß',
  ccedil: 'ç',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
}

/** Convert an HTML feed summary to safe, readable plain text. */
export function htmlToText(value: string): string {
  let decoded = value
  // A few feeds HTML-escape markup inside the already-escaped XML summary.
  // Decode repeatedly so `&#x3C;p>` becomes markup before stripping it.
  for (let pass = 0; pass < 2; pass++) {
    decoded = decoded
      .replace(/&#(x[\da-f]+|\d+);/gi, (entity, code: string) => {
        const point = code[0]?.toLowerCase() === 'x'
          ? Number.parseInt(code.slice(1), 16)
          : Number.parseInt(code, 10)
        try { return Number.isFinite(point) ? String.fromCodePoint(point) : entity }
        catch { return entity }
      })
      .replace(/&([a-z]+);/gi, (entity, name: string) => ENTITIES[name] ?? ENTITIES[name.toLowerCase()] ?? entity)
  }
  return decoded
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<\s*br\s*\/?>|<\/(?:p|div|li|h[1-6])\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
