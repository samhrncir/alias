import { describe, expect, it } from 'vitest'
import { emailRedirectUrl } from './useAuth'

describe('emailRedirectUrl', () => {
  // Supabase only honours redirects that match its allow-list globs; a bare origin
  // misses `https://host/**` and sends people to the Site URL (localhost) instead.
  it('always ends with a slash so it matches https://host/** allow-list entries', () => {
    expect(emailRedirectUrl('https://alias.mappa.systems')).toBe('https://alias.mappa.systems/')
    expect(emailRedirectUrl('http://localhost:5173')).toBe('http://localhost:5173/')
  })
})
