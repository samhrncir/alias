import { AlertTriangle, FileCode2, FilePlus2, Link2, RefreshCw, ShieldCheck, Unlink, Upload } from 'lucide-react'
import type { BashrcLink, LinkStatus } from '../hooks/useBashrcLink'
import { describeBlockProblem } from '../utils/bashrc'
import { formatClock } from '../utils/format'

interface Props {
  link: BashrcLink
  onLink: (kind: 'existing' | 'new') => void
  onImportCopy: () => void
}

const isWindows = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent)

const STATUS_CHIP: Record<LinkStatus, [label: string, tone: string]> = {
  checking: ['scanning', ''],
  unlinked: ['offline', ''],
  'needs-permission': ['locked', 'warn'],
  ready: ['live', 'ok'],
  missing: ['lost', 'danger'],
  error: ['error', 'danger'],
  manual: ['manual', 'warn'],
}

export function LinkPanel(props: Props) {
  const [label, tone] = STATUS_CHIP[props.link.status]
  return (
    <section className="panel" aria-labelledby="link-title">
      <header className="panel-head">
        <h2 id="link-title">
          <span className="kicker">//</span> Link
        </h2>
        <span className={`chip${tone ? ` chip-${tone}` : ''}`}>{label}</span>
      </header>
      <LinkBody {...props} />
    </section>
  )
}

function LinkBody({ link, onLink, onImportCopy }: Props) {
  switch (link.status) {
    case 'checking':
      return <p className="muted">Looking for this PC's linked file…</p>

    case 'unlinked':
      return (
        <div className="stack">
          <p>
            Point Alias at this PC's <code>~/.bashrc</code>. This browser remembers it for next time.
          </p>
          <button type="button" className="btn" onClick={() => onLink('existing')}>
            <Link2 size={16} /> Link .bashrc
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onLink('new')}>
            <FilePlus2 size={16} /> Create a new .bashrc
          </button>
          <ul className="hints">
            {isWindows ? (
              <li>
                In the file dialog, type <code>%USERPROFILE%</code> in the address bar to jump to your home folder.
              </li>
            ) : (
              <li>
                In the file dialog, press <kbd>⌘</kbd>
                <kbd>⇧</kbd>
                <kbd>.</kbd> to show hidden files.
              </li>
            )}
            <li>
              <strong>Create</strong> is for PCs without one: choosing an existing file in that dialog empties it.
            </li>
          </ul>
        </div>
      )

    case 'needs-permission':
      return (
        <div className="stack">
          <p>
            Linked to <code>{link.fileName}</code>. The browser needs your OK to open it again.
          </p>
          <button type="button" className="btn" onClick={() => void link.reconnect()}>
            <ShieldCheck size={16} /> Reconnect
          </button>
          <p className="hint">Choose “Allow on every visit” and you won't be asked again.</p>
          <div className="row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void link.unlink()}>
              <Unlink size={14} /> Unlink
            </button>
          </div>
        </div>
      )

    case 'missing':
    case 'error':
      return (
        <div className="stack">
          <p className="callout callout-error">
            {link.status === 'missing' ? `${link.fileName ?? 'The file'} was moved or deleted.` : link.error}
          </p>
          <div className="row">
            {link.status === 'error' && (
              <button type="button" className="btn btn-sm" onClick={() => void link.reconnect()}>
                <RefreshCw size={14} /> Retry
              </button>
            )}
            <button type="button" className="btn btn-sm" onClick={() => onLink('existing')}>
              <Link2 size={14} /> Link again
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void link.unlink()}>
              <Unlink size={14} /> Unlink
            </button>
          </div>
        </div>
      )

    case 'manual':
      return (
        <div className="stack">
          <p>Direct file access needs Chrome or Edge on desktop. You can still work from a copy:</p>
          <button type="button" className="btn" onClick={onImportCopy}>
            <Upload size={16} /> {link.fileName ? 'Import a newer copy' : 'Import a copy of .bashrc'}
          </button>
          {link.fileName && <FileRow name={link.fileName} at={link.readAt} verb="imported" />}
          <p className="hint">When you're done, download the updated file or copy the block, and put it in place yourself.</p>
        </div>
      )

    case 'ready': {
      const { scan } = link
      return (
        <div className="stack">
          <FileRow name={link.fileName ?? '.bashrc'} at={link.readAt} verb="read" />
          {link.fileName && link.fileName !== '.bashrc' && (
            <p className="callout callout-warn">
              <AlertTriangle size={14} aria-hidden="true" /> Git Bash reads <code>.bashrc</code>; this file is named{' '}
              <code>{link.fileName}</code>.
            </p>
          )}
          {scan?.blockProblem && (
            <p className="callout callout-error">{describeBlockProblem(scan.blockProblem)} Fix it in the Raw tab.</p>
          )}
          {scan && (
            <dl className="stats">
              <div>
                <dt>In block</dt>
                <dd>{scan.managed.length}</dd>
              </div>
              <div>
                <dt>Hand-written</dt>
                <dd>{scan.outside.length}</dd>
              </div>
              <div>
                <dt>Left alone</dt>
                <dd>{scan.complex.length}</dd>
              </div>
            </dl>
          )}
          <div className="row">
            <button type="button" className="btn btn-sm" onClick={() => void link.refresh()}>
              <RefreshCw size={14} /> Re-read
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void link.unlink()}>
              <Unlink size={14} /> Unlink
            </button>
          </div>
        </div>
      )
    }
  }
}

function FileRow({ name, at, verb }: { name: string; at: number | null; verb: string }) {
  return (
    <div className="file-row">
      <FileCode2 size={18} aria-hidden="true" />
      <code className="file-name">{name}</code>
      {at !== null && (
        <span className="muted">
          {verb} {formatClock(at)}
        </span>
      )}
    </div>
  )
}
