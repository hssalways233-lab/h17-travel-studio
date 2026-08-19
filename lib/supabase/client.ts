import { createBrowserClient } from '@supabase/ssr'

const FALLBACK_SUPABASE_URL = 'https://jglwgvgqwfvhcjehrenq.supabase.co'
const FALLBACK_SUPABASE_KEY = 'sb_publishable_e5GzLqgx7fab3lDPI7GehQ_I4UUUg66'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_KEY
  return createBrowserClient(url, key)
}
