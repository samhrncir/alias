import { useState, type FormEvent } from 'react'
import { AlertTriangle, FileCode2, FilePlus2, Link2, Pencil, RefreshCw, ShieldCheck, Unlink, Upload } from 'lucide-react'
import type { BashrcLink, LinkStatus } from '../hooks/useBashrcLink'
import { describeBlockProblem, quoteSingle } from '../utils/bashrc'
import { formatClock } from '../utils/format'
import { CopyChip } from './CopyChip'

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

/** The home folder, which is where the file dialogs steer you. */
function assumedPath(name: string): string {
  return isWindows ? `%USERPROFILE%\\${name}` : `~/${name}`
}

/** A file name as a shell word, quoted only when it has to be. */
function shellName(name: string): string {
  return /^[\w.-]+$/.test(name) ? name : quoteSingle(name)
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
  const pathLine = link.fileName && (
    <PathLine
      path={link.pathLabel ?? assumedPath(link.fileName)}
      assumed={link.pathLabel === null}
      onSave={link.setPathLabel}
    />
  )

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
                In the file dialog, paste <CopyChip text="%USERPROFILE%" /> into the address bar to jump to your home
                folder.
              </li>
            ) : (
              <li>
                In the file dialog, press <kbd>⌘</kbd>
                <kbd>⇧</kbd>
                <kbd>.</kbd> to show hidden files.
              </li>
            )}
            <li>
              Creating one? Type the name as <code>.bashrc</code>, dot included: Chrome drops the dot from its
              suggestion. Only create when there's no .bashrc yet; choosing an existing file there empties it.
            </li>
            <li>
              Or create it from Git Bash with <CopyChip text="touch ~/.bashrc" /> and link it.
            </li>
          </ul>
        </div>
      )

    case 'needs-permission':
      return (
        <div className="stack">
          {pathLine}
          <p>The browser needs your OK to open this file again.</p>
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
          {pathLine}
          <p className="callout callout-error">
            {link.status === 'missing' ? `${link.fileName ?? 'The file'} was moved, renamed or deleted.` : link.error}
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
      const name = link.fileName ?? '.bashrc'
      return (
        <div className="stack">
          <FileRow name={name} at={link.readAt} verb="read" />
          {pathLine}
          {name !== '.bashrc' && <WrongName name={name} onRelink={() => onLink('existing')} />}
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

/** The file's location: a guess until the user corrects it, since browsers don't reveal folders. */
function PathLine({ path, assumed, onSave }: { path: string; assumed: boolean; onSave: (label: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)

  if (draft !== null) {
    const submit = (event: FormEvent) => {
      event.preventDefault()
      onSave(draft)
      setDraft(null)
    }
    return (
      <form className="path-line" onSubmit={submit}>
        <input
          className="input input-sm"
          data-1p-ignore
          data-lpignore="true"
          value={draft}
          autoFocus
          spellCheck={false}
          aria-label="Full path of this file on this PC"
          placeholder="C:\Users\you\.bashrc"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setDraft(null)
          }}
        />
        <button type="submit" className="btn btn-sm">
          Save
        </button>
      </form>
    )
  }

  return (
    <div className="path-line">
      <span className="field-label">Path</span>
      <CopyChip text={path} />
      <button
        type="button"
        className="icon-btn"
        aria-label="Edit the path"
        title="Browsers don't reveal folders. Correct this if the file lives somewhere else."
        onClick={() => setDraft(path)}
      >
        <Pencil size={14} />
      </button>
      {assumed && <span className="hint path-note">Assumed to be your home folder; edit if it's elsewhere.</span>}
    </div>
  )
}

function WrongName({ name, onRelink }: { name: string; onRelink: () => void }) {
  return (
    <div className="callout callout-warn stack-tight">
      <p>
        <AlertTriangle size={14} aria-hidden="true" /> Git Bash only reads <code>.bashrc</code>, but this file is
        named <code>{name}</code>. Chrome drops the leading dot from new-file names.
      </p>
      <p>
        Rename it in Git Bash: <CopyChip text={`mv ~/${shellName(name)} ~/.bashrc`} />
      </p>
      <div className="row">
        <button type="button" className="btn btn-sm" onClick={onRelink}>
          <Link2 size={14} /> Link the renamed .bashrc
        </button>
      </div>
    </div>
  )
}
