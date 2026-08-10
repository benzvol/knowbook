export class FeedFetchError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'FeedFetchError'
  }
}

export class FeedHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'FeedHttpError'
  }
}

export class FeedEmptyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FeedEmptyError'
  }
}

export class FeedParseError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'FeedParseError'
  }
}

export class SourceNotFoundError extends Error {
  constructor(readonly sourceId: number) {
    super(`Source not found: ${sourceId}`)
    this.name = 'SourceNotFoundError'
  }
}

export class SubfeedNotFoundError extends Error {
  constructor(readonly subfeedId: number) {
    super(`Subfeed not found: ${subfeedId}`)
    this.name = 'SubfeedNotFoundError'
  }
}

export class FeedNotFoundError extends Error {
  constructor(readonly feedId: number) {
    super(`Feed not found: ${feedId}`)
    this.name = 'FeedNotFoundError'
  }
}
