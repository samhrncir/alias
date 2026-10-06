import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { ToastContext, type ToastInput, type ToastTone } from '../hooks/useToast'

interface Toast extends ToastInput {
  id: number
}

const LIFETIME_MS: Record<ToastTone, number> = { ok: 4500, info: 5500, warn: 8000, error: 10000 }
const MAX_VISIBLE = 4

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])
  const push = useCallback((toast: ToastInput) => {
    nextId.current += 1
    const id = nextId.current
    setToasts((list) => [...list, { ...toast, id }].slice(-MAX_VISIBLE))
  }, [])

  return (
    <ToastContext value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const { id, action } = toast
  const tone = toast.tone ?? 'info'

  useEffect(() => {
    // Toasts with an action (Undo) stay a little longer.
    const timer = setTimeout(() => onDismiss(id), LIFETIME_MS[tone] + (action ? 4000 : 0))
    return () => clearTimeout(timer)
  }, [id, tone, action, onDismiss])

  return (
    <div className={`toast toast-${tone}`}>
      <span className="toast-prompt" aria-hidden="true">
        &gt;
      </span>
      <p>{toast.text}</p>
      {action && (
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => {
            action.run()
            onDismiss(id)
          }}
        >
          {action.label}
        </button>
      )}
      <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => onDismiss(id)}>
        <X size={14} />
      </button>
    </div>
  )
}
