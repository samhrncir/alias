import { useState } from 'react'
import { CloudUpload } from 'lucide-react'
import { errorMessage } from '../utils/errors'
import { aliasCount } from '../utils/format'
import type { UploadPlan } from '../utils/merge'
import { Modal } from './Modal'

interface Props {
  plan: UploadPlan
  onUpload: () => Promise<void>
  onDismiss: () => void
}

export function UploadDialog({ plan, onUpload, onDismiss }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload() {
    setBusy(true)
    setError(null)
    try {
      await onUpload()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Upload this browser's aliases?"
      kicker="// SYNC UPLINK"
      onClose={onDismiss}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onDismiss}>
            Not now
          </button>
          <button type="button" className="btn btn-cta" disabled={busy} onClick={() => void upload()} data-autofocus>
            <CloudUpload size={16} /> {busy ? 'Uploading…' : `Upload ${aliasCount(plan.upload.length)}`}
          </button>
        </>
      }
    >
      <p>You saved these here before signing in. Your account doesn't have them yet:</p>
      <ul className="name-list">
        {plan.upload.map((a) => (
          <li key={a.id}>
            <code>{a.name}</code>
          </li>
        ))}
      </ul>
      {plan.conflicts.length > 0 && (
        <p className="hint">
          Also in your account with a different command (the account's version is kept): {plan.conflicts.join(', ')}.
        </p>
      )}
      <p className="hint">They also stay in this browser for when you're signed out.</p>
      {error && <p className="callout callout-error">{error}</p>}
    </Modal>
  )
}
