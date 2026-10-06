import { useState } from 'react'
import { ArrowDownToLine } from 'lucide-react'
import { errorMessage } from '../utils/errors'
import type { CandidateStatus, ImportCandidate } from '../utils/merge'
import { Modal } from './Modal'

interface Props {
  candidates: ImportCandidate[]
  /** False in manual mode, where Alias can't write the file. */
  canMove: boolean
  onConfirm: (picked: ImportCandidate[], moveOriginals: boolean) => Promise<void>
  onClose: () => void
}

const STATUS_LABEL: Record<CandidateStatus, string> = { new: 'new', changed: 'differs', same: 'in library' }

export function ImportDialog({ candidates, canMove, onConfirm, onClose }: Props) {
  // Unchanged aliases only matter when their hand-written line could move into the block.
  const rows = candidates.filter((c) => c.status !== 'same' || (canMove && c.movableLines.length > 0))
  const [picked, setPicked] = useState(() => new Set(rows.filter((c) => c.status !== 'changed').map((c) => c.name)))
  const movable = canMove && rows.some((c) => c.movableLines.length > 0)
  const [move, setMove] = useState(movable)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(name: string) {
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm(
        rows.filter((c) => picked.has(c.name)),
        move && movable,
      )
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Pull from file"
      kicker="// JACK IN"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-cta" disabled={busy || picked.size === 0} onClick={() => void confirm()}>
            <ArrowDownToLine size={16} /> {busy ? 'Importing…' : `Import ${picked.size}`}
          </button>
        </>
      }
    >
      {rows.length === 0 ? (
        <p>Nothing new here: your library already has every alias this file defines.</p>
      ) : (
        <>
          <p className="hint">
            New aliases are selected. Ones that differ from your library are not, so nothing gets overwritten unless
            you tick it.
          </p>
          <div className="table-wrap">
            <table className="import-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Import</span>
                  </th>
                  <th scope="col">Alias</th>
                  <th scope="col">In the file</th>
                  <th scope="col">In your library</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.name}>
                    <td>
                      <input
                        type="checkbox"
                        checked={picked.has(c.name)}
                        onChange={() => toggle(c.name)}
                        aria-label={`Import ${c.name}`}
                      />
                    </td>
                    <td>
                      <code className="alias-name">{c.name}</code> <span className={`badge badge-${c.status}`}>{STATUS_LABEL[c.status]}</span>
                    </td>
                    <td>
                      <code>{c.incoming.command}</code>
                      {!c.incoming.enabled && <span className="badge badge-off">off</span>}
                      {c.stayingLines.length > 0 && <p className="hint">An indented copy stays where it is.</p>}
                    </td>
                    <td>{c.existing ? <code>{c.existing.command}</code> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {movable && (
            <label className="check">
              <input type="checkbox" checked={move} onChange={(event) => setMove(event.target.checked)} />
              Move the picked hand-written lines into the ALIAS block{' '}
              <span className="muted">(you'll review the change before anything is written)</span>
            </label>
          )}
        </>
      )}
      {error && <p className="callout callout-error">{error}</p>}
    </Modal>
  )
}
