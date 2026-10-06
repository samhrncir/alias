import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/** Null when cloud sync isn't configured; the app then runs local-only. */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null
