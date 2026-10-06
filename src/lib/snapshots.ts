import { db, type Snapshot, type SnapshotReason } from './db'

export const MAX_SNAPSHOTS = 20

let lastTaken = 0

/** Stores a copy of the file and prunes all but the newest MAX_SNAPSHOTS. */
export async function saveSnapshot(fileName: string, reason: SnapshotReason, content: string): Promise<Snapshot> {
  lastTaken = Math.max(Date.now(), lastTaken + 1)
  const snapshot: Snapshot = {
    id: crypto.randomUUID(),
    takenAt: new Date(lastTaken).toISOString(),
    fileName,
    reason,
    content,
  }
  const tx = (await db()).transaction('snapshots', 'readwrite')
  await tx.store.put(snapshot)
  const keys = await tx.store.index('takenAt').getAllKeys()
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_SNAPSHOTS))) await tx.store.delete(key)
  await tx.done
  return snapshot
}

/** Newest first. */
export async function listSnapshots(): Promise<Snapshot[]> {
  return (await (await db()).getAllFromIndex('snapshots', 'takenAt')).reverse()
}
