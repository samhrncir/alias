import { useEffect, useRef } from 'react'

export type HotkeyMap = Partial<Record<string, (event: KeyboardEvent) => void>>

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
}

/**
 * Page-wide shortcuts: single keys ("n", "/", "t") and mod combos ("mod+s").
 * Single keys don't fire while typing, and nothing fires behind an open dialog.
 */
export function useHotkeys(map: HotkeyMap): void {
  const handlers = useRef(map)
  useEffect(() => {
    handlers.current = map
  })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.repeat) return
      const mod = event.ctrlKey || event.metaKey
      const combo = `${mod ? 'mod+' : ''}${event.key.toLowerCase()}`
      const handler = handlers.current[combo]
      if (!handler) return
      if (document.querySelector('dialog[open]')) {
        // Still stop the browser's own "save page" dialog.
        if (combo === 'mod+s') event.preventDefault()
        return
      }
      if (!mod && isTyping(event.target)) return
      event.preventDefault()
      handler(event)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
