import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Alias } from '../types'
import {
  LOCAL_KEY,
  cloudRepo,
  localRepo,
  readCloudCache,
  readLocal,
  writeCloudCache,
  type Change,
} from '../lib/aliasRepo'
import { supabase } from '../lib/supabase'
import { sortAliases } from '../utils/bashrc'
import { errorMessage } from '../utils/errors'

export type LibraryMode = 'local' | 'cloud'
export type LibraryStatus = 'loading' | 'ready' | 'error'

export interface Library {
  mode: LibraryMode
  status: LibraryStatus
  error: string | null
  aliases: Alias[]
  /** Applies a change right away; resolves with the new library, or rolls back and rejects. */
  commit(change: Change): Promise<Alias[]>
  reload(): Promise<void>
}

const REFETCH_AFTER_MS = 10_000

function cached(userId: string | null): Alias[] {
  return userId ? readCloudCache(userId) : readLocal()
}

/** The alias library: this browser's copy when signed out, the account's when signed in. */
export function useLibrary(userId: string | null): Library {
  const mode: LibraryMode = userId && supabase ? 'cloud' : 'local'
  const repo = useMemo(() => (userId && supabase ? cloudRepo(supabase, userId) : localRepo), [userId])
  const [aliases, setAliases] = useState<Alias[]>(() => cached(userId))
  const [status, setStatus] = useState<LibraryStatus>(mode === 'cloud' ? 'loading' : 'ready')
  const [error, setError] = useState<string | null>(null)
  const [shownFor, setShownFor] = useState(userId)

  const latest = useRef(aliases)
  const activeRepo = useRef(repo)
  const pendingWrites = useRef(0)
  const lastFetch = useRef(0)

  // Signing in or out swaps the store: start over from its cached copy.
  if (shownFor !== userId) {
    setShownFor(userId)
    setAliases(cached(userId))
    setStatus(mode === 'cloud' ? 'loading' : 'ready')
    setError(null)
  }

  useEffect(() => {
    latest.current = aliases
  }, [aliases])

  useEffect(() => {
    activeRepo.current = repo
  }, [repo])

  const reload = useCallback(async () => {
    // A write in flight will leave the state right; don't race it with a stale read.
    if (pendingWrites.current > 0) return
    lastFetch.current = Date.now()
    try {
      const list = sortAliases(await repo.list())
      if (activeRepo.current !== repo || pendingWrites.current > 0) return
      latest.current = list
      setAliases(list)
      setStatus('ready')
      setError(null)
      if (userId) writeCloudCache(userId, list)
    } catch (err) {
      if (activeRepo.current !== repo) return
      setError(errorMessage(err))
      setStatus((s) => (s === 'loading' ? 'error' : s))
    }
  }, [repo, userId])

  useEffect(() => {
    // Fetching from the store is what this effect is for; state is only set after the await.
    // oxlint-disable-next-line react/set-state-in-effect
    void reload()
  }, [reload])

  // Cloud: pick up edits made on other PCs when this tab comes back into focus.
  useEffect(() => {
    if (mode !== 'cloud') return
    const onFocus = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetch.current > REFETCH_AFTER_MS) {
        void reload()
      }
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [mode, reload])

  // Local: other tabs editing the same browser library.
  useEffect(() => {
    if (mode !== 'local') return
    const onStorage = (event: StorageEvent) => {
      if (event.key !== LOCAL_KEY) return
      const list = readLocal()
      latest.current = list
      setAliases(list)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [mode])

  const commit = useCallback(
    async (change: Change) => {
      const previous = latest.current
      const removed = new Set(change.removedIds)
      const byId = new Map(previous.filter((a) => !removed.has(a.id)).map((a) => [a.id, a]))
      for (const a of change.upserted) byId.set(a.id, a)
      const next = sortAliases([...byId.values()])
      latest.current = next
      setAliases(next)
      pendingWrites.current++
      try {
        await repo.apply(change, next)
        if (userId) writeCloudCache(userId, next)
        return next
      } catch (err) {
        latest.current = previous
        setAliases(previous)
        throw err
      } finally {
        pendingWrites.current--
      }
    },
    [repo, userId],
  )

  return { mode, status, error, aliases, commit, reload }
}
