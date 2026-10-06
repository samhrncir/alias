import { db } from './db'

/*
 * The linked ~/.bashrc, via the File System Access API (Chrome and Edge).
 *
 * Each browser keeps its own handle in IndexedDB, which is what makes the
 * link per PC. Permission is only *queried* on page load; *requesting* it
 * needs a recent click, so that only happens from buttons.
 */

const HANDLE_KEY = 'bashrc'
const PICKER_ID = 'alias-bashrc'

export const fileAccessSupported =
  typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function'

function cancelled(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/** Returns null if the user closes the picker. */
export async function pickExistingFile(): Promise<FileSystemFileHandle | null> {
  try {
    const [handle] = (await window.showOpenFilePicker?.({ id: PICKER_ID, multiple: false })) ?? []
    return handle ?? null
  } catch (err) {
    if (cancelled(err)) return null
    throw err
  }
}

/**
 * Save dialog for a brand-new file. Chrome empties whatever file is chosen
 * right away, so the UI only offers this for PCs without a .bashrc.
 */
export async function pickNewFile(): Promise<FileSystemFileHandle | null> {
  try {
    return (await window.showSaveFilePicker?.({ id: PICKER_ID, suggestedName: '.bashrc' })) ?? null
  } catch (err) {
    if (cancelled(err)) return null
    throw err
  }
}

export type AccessMode = 'read' | 'readwrite'

/** Queries permission and, only when `request` is set, asks for it. */
export async function ensurePermission(
  handle: FileSystemFileHandle,
  mode: AccessMode,
  request: boolean,
): Promise<PermissionState> {
  if (!handle.queryPermission) return 'granted'
  const state = await handle.queryPermission({ mode })
  if (state === 'granted' || !request || !handle.requestPermission) return state
  return handle.requestPermission({ mode })
}

export async function readText(handle: FileSystemFileHandle): Promise<string> {
  return (await handle.getFile()).text()
}

/** createWritable writes a swap file that replaces the original on close, so a failed write leaves it intact. */
export async function writeText(handle: FileSystemFileHandle, text: string): Promise<void> {
  const writable = await handle.createWritable()
  try {
    await writable.write(text)
    await writable.close()
  } catch (err) {
    await writable.abort().catch(() => undefined)
    throw err
  }
}

export async function loadLinkedHandle(): Promise<FileSystemFileHandle | null> {
  try {
    return (await (await db()).get('handles', HANDLE_KEY)) ?? null
  } catch {
    return null
  }
}

export async function saveLinkedHandle(handle: FileSystemFileHandle): Promise<void> {
  await (await db()).put('handles', handle, HANDLE_KEY)
}

export async function forgetLinkedHandle(): Promise<void> {
  await (await db()).delete('handles', HANDLE_KEY)
}

/** Fallback for browsers without the API: read a copy of a file the user picks. */
export function openTextFile(): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      file.text().then(
        (text) => resolve({ name: file.name, text }),
        () => resolve(null),
      )
    })
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}

export function downloadText(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
