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
