import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const FALLBACK_SUPABASE_URL = 'https://jglwgvgqwfvhcjehrenq.supabase.co'
const FALLBACK_SUPABASE_KEY = 'sb_publishable_e5GzLqgx7fab3lDPI7GehQ_I4UUUg66'

/**
 * Travel OS is deployed as a fully static, client-only app.
 * Use Supabase's browser/localStorage session with the implicit auth flow so
 * mobile magic links can complete even when the email app hands the link off
 * to Safari/Chrome. The previous @supabase/ssr browser client forced PKCE,
 * whose code verifier is tied to the browser context that initiated login and
 * could leave mobile users looking logged out after tapping the email link.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_KEY

  return createSupabaseClient(url, key, {
    auth: {
      flowType: 'implicit',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}
