/**
 * How a feed member is named in the UI: the source's title, or
 * `Source → Subfeed` when the membership is narrowed to a subfeed.
 *
 * Shared because two layers build it from different shapes — the feeds-list
 * repository from a SQL join, the feed detail page from a hydrated
 * `FeedMemberDetail` — and they must not drift apart.
 */
export function feedMemberLabel(
  sourceTitle: string,
  subfeedName?: string | null,
): string {
  return subfeedName ? `${sourceTitle} → ${subfeedName}` : sourceTitle
}
