// Reads the HTTP status off a failed `$fetch` call (ofetch's `statusCode`),
// for stores that need to route a specific status (e.g. 409) rather than just
// display the message — see `errorMessage`.
export function errorStatus(cause: unknown): number | null {
  if (cause && typeof cause === 'object' && 'statusCode' in cause) {
    const status = (cause as { statusCode?: unknown }).statusCode
    return typeof status === 'number' ? status : null
  }
  return null
}
