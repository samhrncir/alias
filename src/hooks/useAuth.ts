import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface Auth {
  configured: boolean
  /** False until the stored session (if any) has been loaded. */
  ready: boolean
  session: Session | null
  signIn(email: string, password: string): Promise<void>
  /** 'confirm-email' when the project requires email confirmation first. */
  signUp(email: string, password: string): Promise<'signed-in' | 'confirm-email'>
  sendMagicLink(email: string): Promise<void>
  signOut(): Promise<void>
}

function client() {
  if (!supabase) throw new Error('Cloud sync is not configured.')
  return supabase
}

export function useAuth(): Auth {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(supabase === null)

  useEffect(() => {
    if (!supabase) return
    // Fires INITIAL_SESSION right away with the stored session, then on every change.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return {
    configured: supabase !== null,
    ready,
    session,
    async signIn(email, password) {
      const { error } = await client().auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signUp(email, password) {
      const { data, error } = await client().auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) throw error
      return data.session ? 'signed-in' : 'confirm-email'
    },
    async sendMagicLink(email) {
      const { error } = await client().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) throw error
    },
    async signOut() {
      const { error } = await client().auth.signOut()
      if (error) throw error
    },
  }
}
