import { useEffect, useState } from 'react'
import { Download, Eye, History, RotateCcw } from 'lucide-react'
import type { Snapshot, SnapshotReason } from '../lib/db'
import { downloadText } from '../lib/fileAccess'
import { MAX_SNAPSHOTS, listSnapshots } from '../lib/snapshots'
import { errorMessage } from '../utils/errors'
import { formatBytes, formatStamp } from '../utils/format'

interface Props {
  /** Bumped after each write, to reload the list. */
  version: number
  canCompare: boolean
  canRestore: boolean
  onCompare: (snapshot: Snapshot) => void
  onRestore: (snapshot: Snapshot) => void
}

const REASON: Record<SnapshotReason, string> = {
  write: 'before an alias write',
  raw: 'before a raw save',
  restore: 'before a restore',
}

export function BackupsPanel({ version, canCompare, canRestore, onCompare, onRestore }: Props) {
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    listSnapshots().then(
      (list) => {
        if (alive) setSnapshots(list)
      },
      (err: unknown) => {
        if (alive) setError(errorMessage(err))
      },
    )
    return () => {
      alive = false
    }
  }, [version])

  return (
    <section className="panel" aria-labelledby="backups-title">
      <header className="panel-head">
        <h2 id="backups-title">
          <span className="kicker">//</span> Backups
        </h2>
        <span className="chip">last {MAX_SNAPSHOTS} · this browser</span>
      </header>
      <p className="hint">
        Before every write, Alias keeps a copy of the file as it was. Restoring goes through a diff too, and backs up
        the current file first.
      </p>
      {error && <p className="callout callout-error">{error}</p>}
      {snapshots === null ? (
        !error && <p className="empty">Loading backups…</p>
      ) : snapshots.length === 0 ? (
        <p className="empty">No backups yet. The first one is made when Alias first writes your file.</p>
      ) : (
        <ul className="backup-list">
          {snapshots.map((s) => (
            <li key={s.id} className="backup-row">
              <History size={16} aria-hidden="true" className="muted" />
              <span className="backup-when">{formatStamp(s.takenAt)}</span>
              <span className="backup-meta">
                {s.fileName} {REASON[s.reason]} · {formatBytes(s.content)}
              </span>
              <button type="button" className="btn btn-ghost btn-sm" disabled={!canCompare} onClick={() => onCompare(s)}>
                <Eye size={14} /> Compare
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadText('bashrc-backup', s.content)}>
                <Download size={14} /> Download
              </button>
              <button type="button" className="btn btn-sm" disabled={!canRestore} onClick={() => onRestore(s)}>
                <RotateCcw size={14} /> Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
