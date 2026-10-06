import type { Alias } from '../types'
import { oneLine, sortAliases, type BashrcScan, type ScannedAlias } from './bashrc'

/*
 * Pure planning for moving aliases between the file, this browser and the
 * cloud. Nothing here touches storage; callers apply the result.
 */

type Definition = Pick<Alias, 'command' | 'description' | 'enabled'>

export type CandidateStatus = 'new' | 'changed' | 'same'

export interface ImportCandidate {
  name: string
  /** What bash actually ends up with: the last enabled definition in the file. */
  incoming: Definition
  existing: Alias | null
  status: CandidateStatus
  /** Top-level hand-written lines that can move into the ALIAS block. */
  movableLines: number[]
  /** Indented hand-written lines (maybe inside an if/function) that stay put. */
  stayingLines: number[]
}

function sameDefinition(existing: Alias, incoming: Definition): boolean {
  return (
    existing.command === incoming.command &&
    existing.enabled === incoming.enabled &&
    // A missing comment in the file shouldn't count as a change.
    (incoming.description === '' || incoming.description === oneLine(existing.description))
  )
}

/** One candidate per alias name found in the file (block or not). */
export function planImport(library: readonly Alias[], scan: BashrcScan): ImportCandidate[] {
  const byName = new Map(library.map((a) => [a.name, a]))
  const groups = new Map<string, ScannedAlias[]>()
  for (const def of [...scan.managed, ...scan.outside].sort((a, b) => a.line - b.line)) {
    groups.set(def.name, [...(groups.get(def.name) ?? []), def])
  }

  const candidates: ImportCandidate[] = []
  for (const [name, defs] of groups) {
    const effective = defs.filter((d) => d.enabled).at(-1) ?? defs.at(-1)
    if (!effective) continue
    const incoming: Definition = {
      command: effective.command,
      description: effective.description,
      enabled: effective.enabled,
    }
    const existing = byName.get(name) ?? null
    const handWritten = defs.filter((d) => !d.inBlock)
    candidates.push({
      name,
      incoming,
      existing,
      status: !existing ? 'new' : sameDefinition(existing, incoming) ? 'same' : 'changed',
      movableLines: handWritten.filter((d) => !d.indented).map((d) => d.line),
      stayingLines: handWritten.filter((d) => d.indented).map((d) => d.line),
    })
  }
  return sortAliases(candidates)
}

/** Library entries to upsert for the picked candidates (unchanged ones need nothing). */
export function importedAliases(picked: readonly ImportCandidate[], newId: () => string): Alias[] {
  return picked
    .filter((c) => c.status !== 'same')
    .map((c) =>
      c.existing
        ? { ...c.existing, ...c.incoming, description: c.incoming.description || c.existing.description }
        : { id: newId(), name: c.name, ...c.incoming },
    )
}

export interface UploadPlan {
  /** Local aliases whose names the account doesn't have yet, with fresh ids. */
  upload: Alias[]
  /** Names on both sides with different content; the account's version wins. */
  conflicts: string[]
}

export function planCloudUpload(local: readonly Alias[], cloud: readonly Alias[], newId: () => string): UploadPlan {
  const cloudByName = new Map(cloud.map((a) => [a.name, a]))
  const upload: Alias[] = []
  const conflicts: string[] = []
  for (const a of local) {
    const c = cloudByName.get(a.name)
    // Fresh ids: the same local list may be uploaded to more than one account.
    if (!c) upload.push({ ...a, id: newId() })
    else if (c.command !== a.command || c.enabled !== a.enabled || c.description !== a.description) {
      conflicts.push(a.name)
    }
  }
  return { upload, conflicts: conflicts.sort() }
}

export type SyncState = 'synced' | 'new' | 'edited'

export interface BlockComparison {
  /** Per library alias: is the file's block up to date with it? */
  byName: Map<string, SyncState>
  /** Names in the file's block that the library no longer has. */
  removed: string[]
  /** Total alias-level differences between the library and the block. */
  changes: number
}

export function compareWithBlock(library: readonly Alias[], managed: readonly ScannedAlias[]): BlockComparison {
  const inBlock = new Map(managed.map((m) => [m.name, m]))
  const byName = new Map<string, SyncState>()
  let changes = 0
  for (const a of library) {
    const m = inBlock.get(a.name)
    const state: SyncState = !m
      ? 'new'
      : m.command === a.command && m.enabled === a.enabled && m.description === oneLine(a.description)
        ? 'synced'
        : 'edited'
    byName.set(a.name, state)
    if (state !== 'synced') changes++
  }
  const names = new Set(library.map((a) => a.name))
  const removed = [...inBlock.keys()].filter((n) => !names.has(n)).sort()
  return { byName, removed, changes: changes + removed.length }
}
