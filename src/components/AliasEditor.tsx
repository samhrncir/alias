import { useState, type FormEvent, type ReactNode } from 'react'
import type { Alias } from '../types'
import {
  COMMAND_MAX,
  DESCRIPTION_MAX,
  NAME_MAX,
  checkCommand,
  checkName,
  oneLine,
  renderAliasLine,
  type CommandProblem,
  type NameProblem,
} from '../utils/bashrc'
import { errorMessage } from '../utils/errors'
import { Modal } from './Modal'

interface Props {
  /** null for a new alias. */
  initial: Alias | null
  /** Names used by the other aliases. */
  takenNames: ReadonlySet<string>
  onSave: (alias: Alias) => Promise<void>
  onClose: () => void
}

const NAME_MESSAGE: Record<NameProblem, string> = {
  empty: 'Give it a name.',
  'too-long': `Keep the name under ${NAME_MAX} characters.`,
  'leading-dash': "A name can't start with a dash.",
  'invalid-char': 'Use letters, digits and . _ - : @ % + , only.',
}

const COMMAND_MESSAGE: Record<CommandProblem, string> = {
  empty: 'Enter the command it should run.',
  'too-long': `Keep the command under ${COMMAND_MAX} characters.`,
  multiline: 'Keep it on one line; chain commands with && or ;',
}

export function AliasEditor({ initial, takenNames, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [command, setCommand] = useState(initial?.command ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nameProblem = checkName(name)
  const nameError = nameProblem
    ? NAME_MESSAGE[nameProblem]
    : takenNames.has(name)
      ? 'You already have an alias with this name.'
      : null
  const commandProblem = checkCommand(command)
  const commandError = commandProblem ? COMMAND_MESSAGE[commandProblem] : null
  const showName = submitted || name.length > 0
  const showCommand = submitted || command.length > 0
  const preview = renderAliasLine({ name: name || 'name', command: command || '…', description, enabled })

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (nameError || commandError) return
    setSaving(true)
    setError(null)
    try {
      await onSave({ id: initial?.id ?? crypto.randomUUID(), name, command, description: oneLine(description), enabled })
      onClose()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Modal title={initial ? `Edit ${initial.name}` : 'New alias'} kicker={initial ? '// PATCH ENTRY' : '// NEW ENTRY'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <Field label="Name" hint="What you type in the shell." error={showName ? nameError : null}>
          <input
            data-autofocus
            className="input"
            value={name}
            maxLength={NAME_MAX}
            placeholder="gs"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={showName && nameError !== null}
            onChange={(event) => setName(event.target.value.trim())}
          />
        </Field>
        <Field
          label="Command"
          hint="Runs when you type the name; anything you type after the name is passed along."
          error={showCommand ? commandError : null}
        >
          <input
            className="input"
            value={command}
            maxLength={COMMAND_MAX}
            placeholder="git status -sb"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={showCommand && commandError !== null}
            onChange={(event) => setCommand(event.target.value)}
          />
        </Field>
        <Field label="Note (optional)" hint="Saved as a comment next to the alias.">
          <input
            className="input"
            value={description}
            maxLength={DESCRIPTION_MAX}
            placeholder="short status"
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>
        <label className="check">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          Enabled <span className="muted">(disabled aliases stay in the file, commented out)</span>
        </label>

        <div className="preview">
          <span className="kicker">Preview</span>
          <code>{preview}</code>
        </div>

        {error && <p className="callout callout-error">{error}</p>}

        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-cta" disabled={saving}>
            {saving ? 'Saving…' : 'Save alias'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function Field({ label, hint, error, children }: { label: string; hint: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : <span className="field-hint">{hint}</span>}
    </label>
  )
}
