import { FeedEmptyError, FeedFetchError, FeedHttpError } from './errors'

const DEFAULT_TIMEOUT_MS = 15_000
const USER_AGENT = 'knowbook/1.0'

export type FetchImpl = typeof fetch

export interface FetchFeedOptions {
  timeoutMs?: number
  signal?: AbortSignal
  fetchImpl?: FetchImpl
}

export interface FetchedFeed {
  body: string
  contentType: string | null
}

export async function fetchFeed(
  url: string,
  opts: FetchFeedOptions = {},
): Promise<FetchedFeed> {
  const doFetch = opts.fetchImpl ?? fetch
  const timeoutSignal = AbortSignal.timeout(
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  )
  const signal = opts.signal
    ? AbortSignal.any([opts.signal, timeoutSignal])
    : timeoutSignal

  let response: Response
  try {
    response = await doFetch(url, {
      signal,
      headers: { 'User-Agent': USER_AGENT },
    })
  } catch (cause) {
    throw new FeedFetchError(`Failed to fetch feed: ${url}`, cause)
  }

  if (!response.ok) {
    throw new FeedHttpError(
      `Feed request failed with status ${response.status}: ${url}`,
      response.status,
    )
  }

  const body = await response.text()
  if (!body.trim()) {
    throw new FeedEmptyError(`Feed response body was empty: ${url}`)
  }

  return { body, contentType: response.headers.get('content-type') }
}
