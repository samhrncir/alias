import type { SupabaseClient } from '@supabase/supabase-js'
import type { Alias } from '../types'
import { DESCRIPTION_MAX, checkCommand, checkName, oneLine, sortAliases } from '../utils/bashrc'

/*
 * Where the library lives: this browser (signed out) or Supabase (signed in).
 * Both take the same change sets, so useLibrary doesn't care which it has.
 */

export interface Change {
  upserted: readonly Alias[]
  removedIds: readonly string[]
}

export interface AliasRepo {
  list(): Promise<Alias[]>
  /** `next` is the whole library after the change, for stores that save it in one piece. */
  apply(change: Change, next: readonly Alias[]): Promise<void>
}

export const LOCAL_KEY = 'alias.library.v1'
const cacheKey = (userId: string) => `alias.cloud-cache.${userId}`

/** Keeps well-formed entries with unique names; tolerant of old or hand-edited data. */
export function sanitizeAliases(input: unknown): Alias[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const out: Alias[] = []
  for (const item of input) {
    if (!item || typeof item !== 'object') continue
    const { id, name, command, description, enabled } = item as Record<string, unknown>
    if (typeof id !== 'string' || typeof name !== 'string' || typeof command !== 'string') continue
    if (checkName(name) || checkCommand(command) || seen.has(name)) continue
    seen.add(name)
    out.push({
      id,
      name,
      command,
      description: typeof description === 'string' ? oneLine(description).slice(0, DESCRIPTION_MAX) : '',
      enabled: enabled !== false,
    })
  }
  return sortAliases(out)
}

function readJson(key: string): Alias[] {
  try {
    return sanitizeAliases(JSON.parse(localStorage.getItem(key) ?? '[]'))
  } catch {
    return []
  }
}

export function readLocal(): Alias[] {
  return readJson(LOCAL_KEY)
}

export const localRepo: AliasRepo = {
  list: async () => readLocal(),
  apply: async (_change, next) => localStorage.setItem(LOCAL_KEY, JSON.stringify(next)),
}

/** The last list seen from the cloud, so a signed-in reload renders instantly. */
export function readCloudCache(userId: string): Alias[] {
  return readJson(cacheKey(userId))
}

export function writeCloudCache(userId: string, aliases: readonly Alias[]): void {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(aliases))
  } catch {
    // Only a cache; the cloud copy is the real one.
  }
}

export function clearCloudCache(userId: string): void {
  localStorage.removeItem(cacheKey(userId))
}

export function cloudRepo(client: SupabaseClient, userId: string): AliasRepo {
  const table = () => client.from('aliases')
  return {
    async list() {
      const { data, error } = await table().select('id, name, command, description, enabled')
      if (error) throw error
      return sanitizeAliases(data)
    },
    async apply({ upserted, removedIds }) {
      // Deletes first, so a name freed by this change can be reused in it.
      if (removedIds.length > 0) {
        const { error } = await table().delete().in('id', [...removedIds])
        if (error) throw error
      }
      if (upserted.length > 0) {
        const rows = upserted.map((a) => ({ ...a, user_id: userId }))
        const { error } = await table().upsert(rows, { onConflict: 'id' })
        if (error) throw error
      }
    },
  }
}
