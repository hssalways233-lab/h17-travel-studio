import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const FALLBACK_SUPABASE_URL = 'https://jglwgvgqwfvhcjehrenq.supabase.co'
const FALLBACK_SUPABASE_KEY = 'sb_publishable_e5GzLqgx7fab3lDPI7GehQ_I4UUUg66'

let cachedWorkspaceOwnerId: string | null = null

/**
 * Travel OS is a private, single-person workspace.
 * Supabase is used as an anonymous data/storage/realtime backend; there is no
 * visible email, OTP, magic-link or device-code login in the product.
 *
 * A few legacy TravelOS write paths still call auth.getUser() only to obtain a
 * user_id. We expose a compatibility auth facade to the UI while the actual
 * Supabase client continues making requests with the normal publishable/anon
 * key. This avoids attaching a fake JWT to database requests.
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

  // Separate untouched client used only to discover the historical owner id.
  // Its auth implementation remains the real Supabase anonymous client.
  const lookupClient = createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  async function resolveWorkspaceOwnerId() {
    if (cachedWorkspaceOwnerId) return cachedWorkspaceOwnerId

    for (const table of ['destinations', 'topics', 'posts', 'materials']) {
      const { data } = await lookupClient
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
      access_token: '',
      refresh_token: '',
      expires_in: 315360000,
      expires_at: Math.floor(Date.now() / 1000) + 315360000,
      token_type: 'bearer',
      user,
    } as any

    return { user, session }
  }

  const authFacade = {
    async getUser() {
      try {
        const { user } = await workspaceIdentity()
        return { data: { user }, error: null }
      } catch (error) {
        return { data: { user: null }, error }
      }
    },
    async getSession() {
      try {
        const { session } = await workspaceIdentity()
        return { data: { session }, error: null }
      } catch (error) {
        return { data: { session: null }, error }
      }
    },
    onAuthStateChange(callback: any) {
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
    },
    async signOut() {
      return { error: null }
    },
  } as any

  // The Proxy exposes the facade only to application code accessing .auth.
  // SupabaseClient's own internal methods still execute against the untouched
  // target client and therefore continue using anonymous/public-key requests.
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'auth') return authFacade
      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as typeof client
}
