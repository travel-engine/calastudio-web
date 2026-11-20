import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

// Handles both Supabase email-link formats:
//   ?code=…                        (PKCE — needs the code_verifier cookie set at sign-up time,
//                                   so it only works in the same browser)
//   ?token_hash=…&type=signup|…    (OTP — verifier-free, works cross-browser; what the current
//                                   Supabase email templates send)
// Before anything else, let the API fold any existing CalaStudio record with this email onto the
// signed-in user (POST /api/account/link, idempotent). Needed for Google / Apple sign-in: a member
// imported with their welcome email held has no auth user yet, so the provider sign-in creates a new
// one and their memberships, passes and history must be adopted onto it. Non-fatal: the register
// call on the studio site merges by email too.
async function linkAccount(accessToken: string | undefined) {
  if (!accessToken) return
  try {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account/link`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    // Carry on; the person is signed in either way.
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  // Same-site paths only — '//evil.com' or 'https://…' would make this an open redirect.
  const nextParam = searchParams.get('next')
  const next = nextParam?.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard'
  const providerError = searchParams.get('error_description') || searchParams.get('error')

  // Resolve against the host the browser is actually on (a studio subdomain, via proxy.ts), so the
  // session cookie set below and the page it lands on share a host. request.url carries Next's own
  // bound hostname outside Vercel.
  const origin = `${request.nextUrl.protocol}//${request.headers.get('host') ?? request.nextUrl.host}`

  // Where to send someone when the link can't be exchanged — back to whatever page asked for
  // the callback (its own sign-in gate), or the studio signup page as a last resort.
  const failUrl = new URL(next !== '/dashboard' ? next : '/register', origin)
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
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) {
      await linkAccount(data.session?.access_token)
      return NextResponse.redirect(new URL(next, origin))
    }
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      await linkAccount(data.session?.access_token)
      return NextResponse.redirect(new URL(next, origin))
    }
  }

  return NextResponse.redirect(failUrl)
}
