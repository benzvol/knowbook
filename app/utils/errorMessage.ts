// Reads the message off a failed `$fetch` call (h3's `statusMessage`), for
// stores to surface API errors without leaking raw fetch internals.
export function errorMessage(cause: unknown): string {
  if (cause && typeof cause === 'object' && 'statusMessage' in cause) {
    return String((cause as { statusMessage?: string }).statusMessage)
  }
  return cause instanceof Error ? cause.message : 'Unknown error'
}
