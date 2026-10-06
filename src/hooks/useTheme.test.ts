import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useTheme } from './useTheme'

describe('useTheme', () => {
  it('defaults to Night City and applies it to the page', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('night-city')
    expect(document.documentElement.dataset.theme).toBe('night-city')
  })

  it('remembers the chosen theme', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.setTheme('synthwave'))
    expect(document.documentElement.dataset.theme).toBe('synthwave')
    expect(localStorage.getItem('alias.theme')).toBe('synthwave')
    expect(renderHook(() => useTheme()).result.current.theme).toBe('synthwave')
  })

  it('cycles through all three themes', () => {
    const { result } = renderHook(() => useTheme())
    const seen: string[] = [result.current.theme]
    for (let i = 0; i < 3; i++) {
      act(() => result.current.cycle())
      seen.push(result.current.theme)
    }
    expect(seen).toEqual(['night-city', 'synthwave', 'netrunner', 'night-city'])
  })

  it('ignores an unknown stored value', () => {
    localStorage.setItem('alias.theme', 'vaporwave')
    expect(renderHook(() => useTheme()).result.current.theme).toBe('night-city')
  })
})
