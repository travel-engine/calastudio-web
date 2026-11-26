import { createClient } from '@/lib/supabase'
import { clearRememberChoice } from '@/lib/authRemember'

// The browser can hold tokens for a sign-in session Supabase has already ended (signed out on
// another device, "sign out everywhere", session removed). The page then looks signed in but the
// API answers 401 to everything. When that happens, drop the local copy so the sign-in form shows
// again, instead of failing with "try again" forever.

export const SESSION_EXPIRED_MESSAGE = 'Your sign-in has expired. Please sign in again.'

export async function clearDeadSession(): Promise<void> {
  try {
    // Local only: the session is already gone server-side, and a global sign-out would just 403.
    await createClient().auth.signOut({ scope: 'local' })
  } catch { /* nothing to clear */ }
  clearRememberChoice()
}
