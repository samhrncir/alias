import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SnapshotReason } from '../lib/db'
import {
  ensurePermission,
  fileAccessSupported,
  forgetLinkedHandle,
  loadLinkedHandle,
  openTextFile,
  pickExistingFile,
  pickNewFile,
  readText,
  saveLinkedHandle,
  writeText,
} from '../lib/fileAccess'
import { saveSnapshot } from '../lib/snapshots'
import { scanBashrc, type BashrcScan } from '../utils/bashrc'
import { errorMessage } from '../utils/errors'

export type LinkStatus =
  | 'checking'
  | 'unlinked'
  | 'needs-permission'
  | 'ready'
  | 'missing'
  | 'error'
  /** No File System Access API: work on an imported copy, export by copy/download. */
  | 'manual'

interface LinkState {
  status: LinkStatus
  handle: FileSystemFileHandle | null
  fileName: string | null
  /** The file as last read from disk (or imported, in manual mode). */
  text: string | null
  readAt: number | null
  error: string | null
}

export class StaleFileError extends Error {
  constructor() {
    super('The file changed on disk after the preview. Review the changes again.')
    this.name = 'StaleFileError'
  }
}

const UNLINKED: LinkState = { status: 'unlinked', handle: null, fileName: null, text: null, readAt: null, error: null }

const PATH_KEY = 'alias.link-path'

function readPathLabel(): string | null {
  try {
    return localStorage.getItem(PATH_KEY)
  } catch {
    return null
  }
}

async function requireWriteAccess(handle: FileSystemFileHandle): Promise<void> {
  if ((await ensurePermission(handle, 'readwrite', true)) !== 'granted') {
    throw new Error('Alias needs permission to edit the file.')
  }
}

/** This PC's linked .bashrc: the handle, its last-read text, and safe writes. */
export function useBashrcLink() {
  const [state, setState] = useState<LinkState>(() =>
    fileAccessSupported ? { ...UNLINKED, status: 'checking' } : { ...UNLINKED, status: 'manual' },
  )
  const latest = useRef(state)
  useEffect(() => {
    latest.current = state
  }, [state])

  const scan = useMemo<BashrcScan | null>(() => (state.text === null ? null : scanBashrc(state.text)), [state.text])

  // Browsers never reveal where a picked file lives, so the path shown is a label the user can correct.
  const [pathLabel, setPathLabelState] = useState<string | null>(readPathLabel)
  const setPathLabel = useCallback((label: string) => {
    const value = label.trim() || null
    try {
      if (value) localStorage.setItem(PATH_KEY, value)
      else localStorage.removeItem(PATH_KEY)
    } catch {
      // Only a label; fine to lose.
    }
    setPathLabelState(value)
  }, [])

  /** Reads the file if permission allows. Only prompts when `request` is set, which needs a click. */
  const load = useCallback(async (handle: FileSystemFileHandle, request: boolean): Promise<string | null> => {
    try {
      const permission = await ensurePermission(handle, request ? 'readwrite' : 'read', request)
      if (permission !== 'granted') {
        setState({ ...UNLINKED, status: 'needs-permission', handle, fileName: handle.name })
        return null
      }
      const text = await readText(handle)
      setState({ status: 'ready', handle, fileName: handle.name, text, readAt: Date.now(), error: null })
      return text
    } catch (err) {
      const missing = err instanceof DOMException && err.name === 'NotFoundError'
      setState({ ...UNLINKED, status: missing ? 'missing' : 'error', handle, fileName: handle.name, error: errorMessage(err) })
      return null
    }
  }, [])

  // On start, reopen the handle this browser remembers, without prompting.
  useEffect(() => {
    if (!fileAccessSupported) return
    let alive = true
    void loadLinkedHandle().then((handle) => {
      if (!alive) return
      if (handle) void load(handle, false)
      else setState(UNLINKED)
    })
    return () => {
      alive = false
    }
  }, [load])

  // Pick up edits made in other editors when the tab regains focus.
  useEffect(() => {
    const onFocus = () => {
      const { status, handle } = latest.current
      if (document.visibilityState === 'visible' && status === 'ready' && handle) void load(handle, false)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  const link = useCallback(
    async (kind: 'existing' | 'new'): Promise<string | null> => {
      const handle = kind === 'existing' ? await pickExistingFile() : await pickNewFile()
      if (!handle) return null
      await saveLinkedHandle(handle)
      setPathLabel('')
      return load(handle, false)
    },
    [load, setPathLabel],
  )

  const reconnect = useCallback(async () => {
    const { handle } = latest.current
    return handle ? load(handle, true) : null
  }, [load])

  const refresh = useCallback(async () => {
    const { handle } = latest.current
    return handle ? load(handle, false) : null
  }, [load])

  const unlink = useCallback(async () => {
    await forgetLinkedHandle()
    setPathLabel('')
    setState(UNLINKED)
  }, [setPathLabel])

  /** Manual mode: read a copy of the file to compare against and export from. */
  const importCopy = useCallback(async (): Promise<string | null> => {
    const file = await openTextFile()
    if (!file) return null
    setState({ status: 'manual', handle: null, fileName: file.name, text: file.text, readAt: Date.now(), error: null })
    return file.text
  }, [])

  /** A fresh read to plan a write from. Asks for write access now, while the click is recent. */
  const readForWrite = useCallback(async (): Promise<string> => {
    const { handle } = latest.current
    if (!handle) throw new Error('Link your .bashrc first.')
    await requireWriteAccess(handle)
    const text = await readText(handle)
    setState((s) => ({ ...s, status: 'ready', text, readAt: Date.now(), error: null }))
    return text
  }, [])

  /** Writes `after` only if the file still holds `before`; snapshots `before` first and verifies the result. */
  const commit = useCallback(async (before: string, after: string, reason: SnapshotReason): Promise<void> => {
    const { handle } = latest.current
    if (!handle) throw new Error('Link your .bashrc first.')
    await requireWriteAccess(handle)
    if ((await readText(handle)) !== before) throw new StaleFileError()
    await saveSnapshot(handle.name, reason, before)
    await writeText(handle, after)
    const written = await readText(handle)
    setState((s) => ({ ...s, status: 'ready', text: written, readAt: Date.now(), error: null }))
    if (written !== after) throw new Error('The file reads back differently than what was written.')
  }, [])

  return {
    ...state,
    scan,
    pathLabel,
    setPathLabel,
    supported: fileAccessSupported,
    link,
    reconnect,
    refresh,
    unlink,
    importCopy,
    readForWrite,
    commit,
  }
}

export type BashrcLink = ReturnType<typeof useBashrcLink>
