import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
  title: string
  kicker?: string
  size?: 'md' | 'lg'
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

/**
 * A native modal <dialog>: the page behind it is inert, Esc closes it, and
 * focus returns where it was. An element marked data-autofocus gets focus.
 */
export function Modal({ title, kicker, size = 'md', onClose, children, footer }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const pressedBackdrop = useRef(false)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className={`modal modal-${size}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      // Close on a click that both starts and ends on the backdrop, not when a
      // text selection inside the dialog happens to end outside it.
      onMouseDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        if (pressedBackdrop.current && event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal-frame panel">
        <header className="modal-head">
          <div>
            {kicker && <p className="kicker">{kicker}</p>}
            <h2 id={titleId}>{title}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </dialog>
  )
}
