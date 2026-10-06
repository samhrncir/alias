import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export type SnapshotReason = 'write' | 'raw' | 'restore'

/** A copy of the file taken just before Alias overwrote it. */
export interface Snapshot {
  id: string
  /** ISO 8601; strictly increasing, so it also orders snapshots. */
  takenAt: string
  fileName: string
  reason: SnapshotReason
  content: string
}

interface AliasDB extends DBSchema {
  handles: { key: string; value: FileSystemFileHandle }
  snapshots: { key: string; value: Snapshot; indexes: { takenAt: string } }
}

let connection: Promise<IDBPDatabase<AliasDB>> | null = null

/** One shared connection for the page's lifetime (retried if opening fails). */
export function db(): Promise<IDBPDatabase<AliasDB>> {
  connection ??= openDB<AliasDB>('alias', 1, {
    upgrade(database) {
      database.createObjectStore('handles')
      database.createObjectStore('snapshots', { keyPath: 'id' }).createIndex('takenAt', 'takenAt')
    },
  }).catch((err: unknown) => {
    connection = null
    throw err
  })
  return connection
}
