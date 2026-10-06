import { ArrowDownToLine } from 'lucide-react'
import type { BashrcScan } from '../utils/bashrc'
import type { CandidateStatus, ImportCandidate } from '../utils/merge'

interface Props {
  candidates: ImportCandidate[]
  scan: BashrcScan
  onPull: () => void
}

const STATUS_LABEL: Record<CandidateStatus, string> = { new: 'new', changed: 'differs', same: 'in library' }

/** What the linked file defines outside Alias's control, and what Alias leaves alone. */
export function FileScanPanel({ candidates, scan, onPull }: Props) {
  const byName = new Map(candidates.map((c) => [c.name, c]))
  const blockOnly = candidates.filter((c) => c.status !== 'same' && c.movableLines.length + c.stayingLines.length === 0)
  const blockEnd = scan.block?.end ?? null
  const inLibrary = new Set(candidates.filter((c) => c.existing).map((c) => c.name))
  const shadowed = [
    ...new Set(scan.outside.filter((o) => blockEnd !== null && o.line > blockEnd && inLibrary.has(o.name)).map((o) => o.name)),
  ]
  const actionable = candidates.some((c) => c.status !== 'same' || c.movableLines.length > 0)

  if (scan.outside.length === 0 && blockOnly.length === 0 && scan.complex.length === 0) return null

  return (
    <section className="panel" aria-labelledby="scan-title">
      <header className="panel-head">
        <h2 id="scan-title">
          <span className="kicker">//</span> Found in file
        </h2>
        {actionable && (
          <button type="button" className="btn btn-sm" onClick={onPull}>
            <ArrowDownToLine size={14} /> Pull from file…
          </button>
        )}
      </header>

      {scan.outside.length > 0 && (
        <>
          <p className="hint">Hand-written outside the ALIAS block:</p>
          <ul className="scan-list">
            {scan.outside.map((def) => {
              const existing = byName.get(def.name)?.existing
              const status: CandidateStatus = !existing ? 'new' : existing.command === def.command ? 'same' : 'changed'
              return (
                <li key={def.line}>
                  <code className="alias-name">{def.name}</code>
                  <code className="scan-cmd">{def.command}</code>
                  <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>
                  <span className="muted">
                    line {def.line + 1}
                    {def.indented ? ' · indented, stays' : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {blockOnly.length > 0 && (
        <>
          <p className="hint">In the file's ALIAS block, but not in your library (edited somewhere else?):</p>
          <ul className="scan-list">
            {blockOnly.map((c) => (
              <li key={c.name}>
                <code className="alias-name">{c.name}</code>
                <code className="scan-cmd">{c.incoming.command}</code>
                <span className={`badge badge-${c.status}`}>{STATUS_LABEL[c.status]}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {shadowed.length > 0 && (
        <p className="callout callout-warn">
          {shadowed.join(', ')} {shadowed.length === 1 ? 'is' : 'are'} defined again after the ALIAS block, so bash
          uses that later definition.
        </p>
      )}

      {scan.complex.length > 0 && (
        <>
          <p className="hint">Left alone (Alias never touches these):</p>
          <ul className="scan-list">
            {scan.complex.map((c) => (
              <li key={c.line}>
                <span className="muted">line {c.line + 1}</span>
                <code className="scan-cmd">{c.text.trim()}</code>
                <span className="muted">{c.reason}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
