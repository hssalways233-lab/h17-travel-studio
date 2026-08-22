import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const FALLBACK_SUPABASE_URL = 'https://jglwgvgqwfvhcjehrenq.supabase.co'
const FALLBACK_SUPABASE_KEY = 'sb_publishable_e5GzLqgx7fab3lDPI7GehQ_I4UUUg66'

let cachedWorkspaceOwnerId: string | null = null

/**
 * Travel OS is a private, single-person workspace.
 * Database + Storage RLS are configured for shared anon access, so the UI no
 * longer needs a visible email / magic-link / device-code login flow.
 *
 * Some legacy rows and write paths still expect a user_id. To preserve the
 * existing schema without a migration rewrite, we resolve the owner id from
 * existing workspace rows and expose it through a tiny invisible auth shim.
 * This is NOT a security boundary; possession of the private workspace URL is
 * effectively access to the workspace.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_KEY

  const client = createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  async function resolveWorkspaceOwnerId() {
    if (cachedWorkspaceOwnerId) return cachedWorkspaceOwnerId

    for (const table of ['destinations', 'topics', 'posts', 'materials']) {
      const { data } = await client
        .from(table)
        .select('user_id')
        .not('user_id', 'is', null)
        .limit(1)
        .maybeSingle()

      const id = (data as { user_id?: string } | null)?.user_id
      if (id) {
        cachedWorkspaceOwnerId = id
        return id
      }
    }

    throw new Error('无法识别工作区 owner。请确认 Supabase 中仍保留现有旅行数据。')
  }

  async function workspaceIdentity() {
    const id = await resolveWorkspaceOwnerId()
    const user = {
      id,
      email: 'workspace@local',
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: { workspace: 'h17' },
      identities: [],
      created_at: new Date(0).toISOString(),
    } as any

    const session = {
      access_token: 'workspace-local',
      refresh_token: 'workspace-local',
      expires_in: 315360000,
      expires_at: Math.floor(Date.now() / 1000) + 315360000,
      token_type: 'bearer',
      user,
    } as any

    return { user, session }
  }

  // Compatibility layer for legacy TravelOS write paths. No email, OTP,
  // magic link or device code is sent or required.
  ;(client.auth as any).getUser = async () => {
    try {
      const { user } = await workspaceIdentity()
      return { data: { user }, error: null }
    } catch (error) {
      return { data: { user: null }, error }
    }
  }

  ;(client.auth as any).getSession = async () => {
    try {
      const { session } = await workspaceIdentity()
      return { data: { session }, error: null }
    } catch (error) {
      return { data: { session: null }, error }
    }
  }

  ;(client.auth as any).onAuthStateChange = (callback: any) => {
    let active = true
    void workspaceIdentity().then(({ session }) => {
      if (active) callback('SIGNED_IN', session)
    })
    return {
      data: {
        subscription: {
          unsubscribe() {
            active = false
          },
        },
      },
    }
  }

  ;(client.auth as any).signOut = async () => ({ error: null })

  return client
}
