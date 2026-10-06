import { useMemo, useState } from 'react'
import { HardDriveDownload } from 'lucide-react'
import type { WritePlan } from '../types'
import { normalize } from '../utils/bashrc'
import { errorMessage } from '../utils/errors'
import { lineDiff } from '../utils/lineDiff'
import { Modal } from './Modal'

interface Props {
  plan: WritePlan
  /** Omitted for compare-only plans. */
  onConfirm?: () => Promise<void>
  onClose: () => void
}

const SIGN = { add: '+', del: '−', same: ' ' } as const

export function DiffDialog({ plan, onConfirm, onClose }: Props) {
  // Compare line content; line-ending changes are called out as notices instead.
  const diff = useMemo(() => lineDiff(normalize(plan.before).text, normalize(plan.after).text), [plan])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    if (!onConfirm) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      title={plan.title}
      kicker={plan.kicker}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <span className="diff-stats">
            <span className="plus">+{diff.added}</span> <span className="minus">−{diff.removed}</span>
          </span>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {onConfirm ? 'Cancel' : 'Close'}
          </button>
          {onConfirm && (
            <button type="button" className="btn btn-cta" disabled={busy} onClick={() => void confirm()} data-autofocus>
              <HardDriveDownload size={16} /> {busy ? 'Writing…' : plan.confirmLabel}
            </button>
          )}
        </>
      }
    >
      {plan.notices.map((notice) => (
        <p key={notice} className="callout callout-warn">
          {notice}
        </p>
      ))}
      {onConfirm && <p className="hint">A backup of the current file is kept first (Backups tab).</p>}
      <div className="diff" tabIndex={0} aria-label="Line changes">
        {diff.rows.map((row, i) =>
          row.kind === 'gap' ? (
            <div key={i} className="diff-gap">
              ··· {row.count} unchanged line{row.count === 1 ? '' : 's'} ···
            </div>
          ) : (
            <div key={i} className={`diff-row diff-${row.kind}`}>
              <span className="diff-no">{row.oldNo ?? ''}</span>
              <span className="diff-no">{row.newNo ?? ''}</span>
              <span className="diff-sign">{SIGN[row.kind]}</span>
              <span className="diff-text">{row.text || ' '}</span>
            </div>
          ),
        )}
      </div>
      {error && <p className="callout callout-error">{error}</p>}
    </Modal>
  )
}
