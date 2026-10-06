import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'

interface Props {
  text: string
}

/** Inline code that copies itself to the clipboard when clicked. */
export function CopyChip({ text }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => setState('idle'), 1600)
    return () => clearTimeout(timer)
  }, [state])

  function copy() {
    const write = navigator.clipboard?.writeText(text) ?? Promise.reject(new Error('Clipboard unavailable'))
    write.then(
      () => setState('copied'),
      () => setState('failed'),
    )
  }

  return (
    <button
      type="button"
      className={`copy-chip${state === 'copied' ? ' is-copied' : ''}`}
      title={state === 'failed' ? "Couldn't copy; select the text instead" : 'Click to copy'}
      onClick={copy}
    >
      <code>{text}</code>
      {state === 'copied' ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
      <span className="sr-only">{state === 'copied' ? '(copied)' : '(copy)'}</span>
    </button>
  )
}
