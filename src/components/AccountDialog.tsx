import { useState, type FormEvent } from 'react'
import { CloudUpload, LogIn, LogOut, Mail, UserPlus } from 'lucide-react'
import type { Auth } from '../hooks/useAuth'
import { errorMessage } from '../utils/errors'
import { aliasCount } from '../utils/format'
import { Modal } from './Modal'

interface Props {
  auth: Auth
  /** Aliases in this browser's signed-out library that the account doesn't have. */
  localOnly: number
  onUploadLocal: () => Promise<void>
  onSignOut: () => Promise<void>
  onClose: () => void
}

type Note = { tone: 'ok' | 'error'; text: string } | null

export function AccountDialog({ auth, localOnly, onUploadLocal, onSignOut, onClose }: Props) {
  const [method, setMethod] = useState<'password' | 'link'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Note>(null)

  async function run(task: () => Promise<string | void>) {
    setBusy(true)
    setNote(null)
    try {
      const text = await task()
      if (text) setNote({ tone: 'ok', text })
    } catch (err) {
      setNote({ tone: 'error', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  const noteView = note && <p className={`callout ${note.tone === 'ok' ? 'callout-ok' : 'callout-error'}`}>{note.text}</p>
  const user = auth.session?.user

  if (user) {
    return (
      <Modal title="Cloud sync" kicker="// UPLINK ONLINE" onClose={onClose}>
        <p>
          Signed in as <strong>{user.email}</strong>. Your library syncs to this account on every PC where you sign in.
        </p>
        {localOnly > 0 && (
          <div className="callout row">
            <span>This browser also has {aliasCount(localOnly)} that your account doesn't.</span>
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await onUploadLocal()
                  return 'Uploaded.'
                })
              }
            >
              <CloudUpload size={14} /> Upload
            </button>
          </div>
        )}
        {noteView}
        <div className="actions">
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void run(onSignOut)}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </Modal>
    )
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (method === 'link') {
      void run(async () => {
        await auth.sendMagicLink(email)
        return `Sign-in link sent to ${email}. Open it in this browser.`
      })
    } else {
      void run(async () => {
        await auth.signIn(email, password)
        onClose()
      })
    }
  }

  function signUp() {
    void run(async () => {
      if ((await auth.signUp(email, password)) === 'confirm-email') {
        return 'Check your inbox to confirm the account, then sign in here.'
      }
      onClose()
    })
  }

  return (
    <Modal title="Sign in to sync" kicker="// SYNC UPLINK" onClose={onClose}>
      <p className="hint">
        Optional. Signed in, your library follows you to every PC. Signed out, it stays in this browser.
      </p>
      <div className="segmented" role="group" aria-label="Sign-in method">
        <button type="button" aria-pressed={method === 'password'} onClick={() => setMethod('password')}>
          Password
        </button>
        <button type="button" aria-pressed={method === 'link'} onClick={() => setMethod('link')}>
          Email link
        </button>
      </div>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span className="field-label">Email</span>
          <input
            data-autofocus
            className="input"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {method === 'password' && (
          <label className="field">
            <span className="field-label">Password</span>
            <input
              className="input"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        )}
        {noteView}
        <div className="actions">
          {method === 'password' && (
            <button type="button" className="btn btn-ghost" disabled={busy || !email || password.length < 6} onClick={signUp}>
              <UserPlus size={16} /> Create account
            </button>
          )}
          <button type="submit" className="btn btn-cta" disabled={busy || !email || (method === 'password' && !password)}>
            {method === 'link' ? (
              <>
                <Mail size={16} /> Send link
              </>
            ) : (
              <>
                <LogIn size={16} /> Sign in
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
