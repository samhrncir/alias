/** A readable message for anything thrown (Supabase errors aren't always Error instances). */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return String(err)
}
