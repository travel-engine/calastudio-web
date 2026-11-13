import { createBrowserClient } from '@supabase/ssr'
import { createClient as createJsClient, type SupabaseClient } from '@supabase/supabase-js'

// Inside the website widget (an iframe on a studio's own site) the app is a third-party context:
// Safari — and any browser blocking third-party cookies — refuses the cookies @supabase/ssr keeps
// the session in, so sign-in would appear to work and then be lost on the next read. There the
// session lives in localStorage instead, which browsers partition per embedding site rather than
// block. Members sign in once per studio website; the top-level site and dashboard keep cookies.
let framedClient: SupabaseClient | null = null

function isFramed(): boolean {
  if (typeof window === 'undefined') return false
  try { return window.self !== window.top } catch { return true }
}

export function createClient(): SupabaseClient {
  if (isFramed()) {
    return (framedClient ??= createJsClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { storageKey: 'cs-embed-auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } },
    ))
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
