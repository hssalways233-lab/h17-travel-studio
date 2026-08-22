'use client'

import TravelOS from '@/components/TravelOS'

/**
 * Travel OS runs as a private, no-login shared workspace.
 * Supabase is used only for data, storage and realtime sync.
 */
export default function AuthGate(){
  return <TravelOS/>
}
