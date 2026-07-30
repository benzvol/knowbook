// better-sqlite3 throws a `SqliteError` whose `.code` starts with
// `SQLITE_CONSTRAINT` (e.g. `SQLITE_CONSTRAINT_UNIQUE`) and surfaces unwrapped
// through Drizzle, so it's directly inspectable at the route layer.
export function isUniqueViolation(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    String((cause as { code: unknown }).code).startsWith('SQLITE_CONSTRAINT')
  )
}
