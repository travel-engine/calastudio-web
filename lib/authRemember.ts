// "Remember me" session policy.
//
// @supabase/ssr v0.12.x forces a 400-day cookie lifetime (it spreads your cookieOptions then
// overrides maxAge back to the default — see node_modules/@supabase/ssr/dist/main/cookies.js),
// so a real session-scoped cookie isn't available. Instead we treat "remember me" as an
// app-side policy: when it's off, the session is capped and a mount guard signs the user out
// once the cap is exceeded.
//
// Fail-safe: every storage access is guarded, and any failure resolves to "not expired" —
// i.e. the user stays logged in. We only ever force a sign-out on a definite, readable signal.

const REMEMBER_KEY = 'cs-remember'
const LOGIN_AT_KEY = 'cs-login-at'

// How long an un-remembered session lasts before the guard ends it.
export const SESSION_CAP_MS = 12 * 60 * 60 * 1000

/** Record the user's choice immediately after a successful password sign-in. */
export function setRememberChoice(remember: boolean) {
  try {
    if (remember) {
      localStorage.setItem(REMEMBER_KEY, '1')
      localStorage.removeItem(LOGIN_AT_KEY)
    } else {
      localStorage.setItem(REMEMBER_KEY, '0')
      localStorage.setItem(LOGIN_AT_KEY, String(Date.now()))
    }
  } catch {
    /* storage unavailable — nothing to record, user stays remembered */
  }
}

/** Clear the markers on sign-out so a later sign-in starts clean. */
export function clearRememberChoice() {
  try {
    localStorage.removeItem(REMEMBER_KEY)
    localStorage.removeItem(LOGIN_AT_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * True only when the user explicitly chose "don't remember me" AND the recorded sign-in time is
 * older than the cap. Anything ambiguous (no markers, unreadable storage, unparseable timestamp)
 * returns false so the session is left alone.
 */
export function isSessionExpiredByPolicy(): boolean {
  try {
    if (localStorage.getItem(REMEMBER_KEY) !== '0') return false
    const at = Number(localStorage.getItem(LOGIN_AT_KEY))
    if (!Number.isFinite(at) || at <= 0) return false
    return Date.now() - at > SESSION_CAP_MS
  } catch {
    return false
  }
}
