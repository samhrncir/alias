import { useCallback, useEffect, useState } from 'react'

export const THEMES = [
  { id: 'night-city', name: 'Night City' },
  { id: 'synthwave', name: 'Synthwave' },
  { id: 'netrunner', name: 'Netrunner' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

const STORAGE_KEY = 'alias.theme'
const DEFAULT_THEME: ThemeId = 'night-city'

function isTheme(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

export function readStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return isTheme(stored) ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

/** Switches the page's token set; the browser UI colour follows the theme's --bg. */
export function applyTheme(theme: ThemeId): void {
  const root = document.documentElement
  root.dataset.theme = theme
  const background = getComputedStyle(root).getPropertyValue('--bg').trim()
  if (background) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background)
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeId>(readStoredTheme)

  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // A preference only; fine to lose.
    }
  }, [theme])

  const cycle = useCallback(() => {
    setTheme((current) => THEMES[(THEMES.findIndex((t) => t.id === current) + 1) % THEMES.length]?.id ?? DEFAULT_THEME)
  }, [])

  return { theme, setTheme, cycle }
}
