import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const FALLBACK_SUPABASE_URL = 'https://jglwgvgqwfvhcjehrenq.supabase.co'
const FALLBACK_SUPABASE_KEY = 'sb_publishable_e5GzLqgx7fab3lDPI7GehQ_I4UUUg66'

/**
 * Private Travel OS uses a real Supabase anonymous session as the device id.
 * The session is persisted in localStorage, so each phone/computer only needs
 * the private passphrase once unless browser storage is cleared.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_KEY

  return createSupabaseClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })
}
