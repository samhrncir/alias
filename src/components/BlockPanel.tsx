import { useMemo } from 'react'
import { Copy, Download, HardDriveDownload } from 'lucide-react'
import type { Alias } from '../types'
import { renderBlock, tokenizeRenderedLine } from '../utils/bashrc'
import type { BlockComparison } from '../utils/merge'

interface Props {
  aliases: Alias[]
  comparison: BlockComparison | null
  pending: boolean
  /** Why writing isn't possible right now, or null when it is. */
  writeBlocker: string | null
  manual: boolean
  onWrite: () => void
  onCopy: () => void
  onDownload: () => void
}

export function BlockPanel({ aliases, comparison, pending, writeBlocker, manual, onWrite, onCopy, onDownload }: Props) {
  const lines = useMemo(() => renderBlock(aliases), [aliases])
  const active = aliases.filter((a) => a.enabled).length
  const counts = useMemo(() => {
    if (!comparison) return null
    let added = 0
    let edited = 0
    for (const state of comparison.byName.values()) {
      if (state === 'new') added++
      else if (state === 'edited') edited++
    }
    return { added, edited, removed: comparison.removed.length }
  }, [comparison])

  const inSync = comparison !== null && !pending
  const label =
    writeBlocker ??
    (inSync ? 'In sync' : comparison && comparison.changes > 0 ? `Write to file · ${comparison.changes}` : 'Write to file')

  return (
    <section className="panel" aria-labelledby="block-title">
      <header className="panel-head">
        <h2 id="block-title">
          <span className="kicker">//</span> Block
        </h2>
        <span className="chip">{active} active</span>
      </header>

      {counts && (
        <div className="summary" aria-label="Changes since the last write">
          {inSync ? (
            <span className="chip chip-ok">in sync with the file</span>
          ) : (
            <>
              {counts.added > 0 && <span className="chip chip-ok">+{counts.added} new</span>}
              {counts.edited > 0 && <span className="chip chip-warn">~{counts.edited} edited</span>}
              {counts.removed > 0 && <span className="chip chip-danger">−{counts.removed} removed</span>}
              {counts.added + counts.edited + counts.removed === 0 && <span className="chip chip-warn">formatting only</span>}
            </>
          )}
        </div>
      )}

      <pre className="code" aria-label="ALIAS block preview" tabIndex={0}>
        {lines.map((line, i) => (
          <BlockLine key={i} line={line} />
        ))}
      </pre>

      <div className="stack">
        {manual ? (
          <button type="button" className="btn btn-cta btn-block" onClick={onDownload}>
            <Download size={16} /> Download updated file
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-cta btn-block"
            onClick={onWrite}
            disabled={writeBlocker !== null || inSync}
          >
            <HardDriveDownload size={16} /> {label}
          </button>
        )}
        <button type="button" className="btn btn-sm" onClick={onCopy}>
          <Copy size={14} /> Copy block
        </button>
      </div>
    </section>
  )
}

function BlockLine({ line }: { line: string }) {
  const tokens = tokenizeRenderedLine(line)
  if (!tokens) {
    return (
      <span className="tok-comment">
        {line}
        {'\n'}
      </span>
    )
  }
  return (
    <span className={tokens.disabled ? 'tok-disabled' : undefined}>
      {tokens.disabled && <span className="tok-comment"># </span>}
      <span className="tok-kw">alias</span> <span className="tok-name">{tokens.name}</span>
      <span className="tok-op">=</span>
      <span className="tok-str">{tokens.value}</span>
      {tokens.comment && <span className="tok-comment">{`  # ${tokens.comment}`}</span>}
      {'\n'}
    </span>
  )
}
