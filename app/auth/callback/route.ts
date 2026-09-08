import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

// Handles both Supabase email-link formats:
//   ?code=…                        (PKCE — needs the code_verifier cookie set at sign-up time,
//                                   so it only works in the same browser)
//   ?token_hash=…&type=signup|…    (OTP — verifier-free, works cross-browser; what the current
//                                   Supabase email templates send)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/dashboard'
  const providerError = searchParams.get('error_description') || searchParams.get('error')

  // Where to send someone when the link can't be exchanged — back to whatever page asked for
  // the callback (its own sign-in gate), or the studio signup page as a last resort.
  const failUrl = new URL(next !== '/dashboard' ? next : '/register', request.url)
  failUrl.searchParams.set('error', 'auth')

  if (providerError) {
    return NextResponse.redirect(failUrl)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) return NextResponse.redirect(new URL(next, request.url))
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, request.url))
  }

  return NextResponse.redirect(failUrl)
}
