import type { SnapshotReason } from './lib/db'

/** One bash alias in the library. */
export interface Alias {
  id: string
  name: string
  /** Stored verbatim: surrounding whitespace is meaningful to bash (`alias sudo='sudo '`). */
  command: string
  description: string
  enabled: boolean
}

/** A pending change to the file, shown as a diff before anything is written. */
export interface WritePlan {
  kicker: string
  title: string
  /** The file exactly as read; the write only goes ahead if it still holds this. */
  before: string
  after: string
  reason: SnapshotReason
  notices: string[]
  confirmLabel: string
  success: string
  /** Only compare (e.g. a backup against the file); nothing to write. */
  readOnly?: boolean
}
