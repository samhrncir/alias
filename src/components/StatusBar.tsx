import type { LinkStatus } from '../hooks/useBashrcLink'
import type { LibraryMode } from '../hooks/useLibrary'

interface Props {
  linkStatus: LinkStatus
  fileName: string | null
  mode: LibraryMode
  count: number
  /** Alias-level differences from the file's block; null with no file to compare. */
  changes: number | null
  pending: boolean
}

const LINK_LABEL: Record<LinkStatus, string> = {
  checking: 'SCANNING',
  unlinked: 'NONE',
  'needs-permission': 'LOCKED',
  ready: 'LIVE',
  missing: 'LOST',
  error: 'ERROR',
  manual: 'MANUAL',
}

export function StatusBar({ linkStatus, fileName, mode, count, changes, pending }: Props) {
  const sync = changes === null ? null : changes > 0 ? `${changes} PENDING` : pending ? 'FORMAT PENDING' : 'IN SYNC'
  return (
    <footer className="statusbar">
      <span className={`status-dot${linkStatus === 'ready' ? ' is-on' : ''}`} aria-hidden="true" />
      <span>
        LINK {LINK_LABEL[linkStatus]}
        {fileName ? ` ${fileName}` : ''}
      </span>
      <span className="sep" aria-hidden="true">
        //
      </span>
      <span>MODE {mode === 'cloud' ? 'CLOUD' : 'LOCAL'}</span>
      <span className="sep" aria-hidden="true">
        //
      </span>
      <span>
        {count} {count === 1 ? 'ALIAS' : 'ALIASES'}
      </span>
      {sync && (
        <>
          <span className="sep" aria-hidden="true">
            //
          </span>
          <span className={changes || pending ? 'status-pending' : 'status-sync'}>{sync}</span>
        </>
      )}
      <span className="statusbar-keys" aria-hidden="true">
        <span>
          <kbd>/</kbd> search
        </span>
        <span>
          <kbd>N</kbd> new
        </span>
        <span>
          <kbd>T</kbd> theme
        </span>
        <span>
          <kbd>Ctrl</kbd>+<kbd>S</kbd> write
        </span>
      </span>
    </footer>
  )
}
