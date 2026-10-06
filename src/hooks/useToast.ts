import { createContext, useContext } from 'react'

export type ToastTone = 'ok' | 'info' | 'warn' | 'error'

export interface ToastInput {
  tone?: ToastTone
  text: string
  action?: { label: string; run: () => void }
}

export const ToastContext = createContext<(toast: ToastInput) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}
