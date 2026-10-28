import { isAuthWeakPasswordError } from '@supabase/supabase-js'

// The password rule is enforced by Supabase Auth (project settings → Auth → Email: minimum length
// 10, leaked-password protection on), for staff and members alike. This file only mirrors it so
// forms can say what's wrong before the round trip, and turns Supabase's errors into plain words.
// If the Supabase setting changes, change MIN_PASSWORD_LENGTH to match.

export const MIN_PASSWORD_LENGTH = 10

export const PASSWORD_HINT = `At least ${MIN_PASSWORD_LENGTH} characters. A few words strung together works well.`

/** A reason to stop before calling Supabase, or null when the password meets the rule. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`
  return null
}

/** Supabase's sign-up / updateUser error, in words a member understands. */
export function authErrorMessage(error: { message: string } | null | undefined, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback
  if (isAuthWeakPasswordError(error)) {
    if (error.reasons.includes('pwned')) {
      return 'That password has appeared in a known data breach, so it isn’t safe to use. Please choose a different one.'
    }
    if (error.reasons.includes('length')) return `Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`
    return 'That password is too weak. Please choose a longer one.'
  }
  // Auth emails go through the API's Send Email Hook; when it fails Supabase reports
  // "Unexpected status code returned from hook: 500", which means nothing to a visitor.
  if (/returned from hook|hook/i.test(error.message)) {
    return 'We couldn’t send your confirmation email just now. Please try again in a few minutes.'
  }
  return error.message || fallback
}
