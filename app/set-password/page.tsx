'use client'

import { useEffect, useRef, useState } from 'react'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase'
import { MIN_PASSWORD_LENGTH, authErrorMessage, passwordProblem } from '@/lib/passwordPolicy'
import Link from 'next/link'
import PasswordInput from '@/app/components/PasswordInput'
import { useRouter } from 'next/navigation'
import { studioSlugFromHost, studioUrl } from '@/lib/seo'

// Landing page for the invite / recovery link sent to studio-added members and invited teachers
// (backend: teacher-member-invite-emails). The email link is
//   {APP_URL}/set-password?token_hash=…&type=recovery&email=…
// — the raw OTP params, NOT a Supabase verify URL. We read them on load but do NOT verify then:
// verifyOtp consumes the single-use token, so an email link scanner that just fetches the page
// would burn it. verifyOtp runs only when the user submits the form (a real click). After that:
// updateUser({ password }) → POST /api/account/link → route by the returned memberships.
//
// Welcome / invite emails now carry a long-lived invite token instead:
//   {APP_URL}/set-password?invite=…
// It never expires while the account is unclaimed. On submit we POST it to
// /api/public/invites/redeem, which mints a fresh token_hash for that person; then the same
// verifyOtp → updateUser path as above. Redeeming doesn't use the invite up, so a link scanner or a
// double tap is harmless; once the account has been signed into, the API answers 410.
//
// A session already present on load (the dashboard /forgot-password flow lands here via
// /auth/callback, which exchanges its own code) skips verifyOtp and goes straight to updateUser.

const STAFF_ROLES = ['admin', 'teacher_super', 'teacher_general', 'teacher_basic', 'front_desk']

interface Membership {
  organisation_id: string
  slug: string
  name: string
  roles: string[]
}

export default function SetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [phase, setPhase] = useState<'checking' | 'no-session' | 'form' | 'claimed' | 'done'>('checking')
  // Shows an "Email me a new link" link under a submit-time error about a dead link.
  const [offerNewLink, setOfferNewLink] = useState(false)
  const [doneNote, setDoneNote] = useState('')
  const [linkError, setLinkError] = useState<{ code: string; description: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const settledRef = useRef(false)
  // OTP params from the emailed link, captured on load but only verified on submit.
  const pendingOtpRef = useRef<{ tokenHash: string; type: EmailOtpType } | null>(null)
  const verifiedRef = useRef(false)
  // Long-lived invite token from a welcome / invite email, redeemed on submit.
  const pendingInviteRef = useRef<string | null>(null)

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search)

    // A stale/rejected link can still redirect here with an error on the query string.
    if (qs.get('error') || qs.get('error_code')) {
      setLinkError({
        code: qs.get('error_code') || qs.get('error') || '',
        description: decodeURIComponent((qs.get('error_description') || '').replace(/\+/g, ' ')),
      })
      settledRef.current = true
      setPhase('no-session')
      window.history.replaceState(null, '', window.location.pathname)
      return
    }

    // Welcome / invite link: long-lived token, exchanged for a fresh one-time token on submit.
    const invite = qs.get('invite')
    if (invite) {
      pendingInviteRef.current = invite
      settledRef.current = true
      setPhase('form')
      window.history.replaceState(null, '', window.location.pathname)
      return
    }

    // Older emails / password resets: raw OTP params on the query string. Stash them; verifyOtp runs on submit only.
    const tokenHash = qs.get('token_hash')
    const type = qs.get('type')
    if (tokenHash && type) {
      pendingOtpRef.current = { tokenHash, type: type as EmailOtpType }
      settledRef.current = true
      setPhase('form')
      window.history.replaceState(null, '', window.location.pathname)
      return
    }

    // No token in the URL — only valid if a session already exists (dashboard /forgot-password
    // via /auth/callback). onAuthStateChange fires INITIAL_SESSION once that's resolved.
    const supabase = createClient()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (settledRef.current) return
      if (session) {
        settledRef.current = true
        setPhase('form')
      } else if (_event === 'INITIAL_SESSION') {
        settledRef.current = true
        setPhase('no-session')
      }
    })

    // Fallback in case no event lands (shouldn't happen, but don't hang on "checking" forever).
    const t = setTimeout(async () => {
      if (settledRef.current) return
      const { data } = await supabase.auth.getSession()
      settledRef.current = true
      setPhase(data.session ? 'form' : 'no-session')
    }, 4000)

    return () => { sub.subscription.unsubscribe(); clearTimeout(t) }
  }, [])

  const routeOnward = async (token: string) => {
    let memberships: Membership[] = []
    let merged = 0
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/account/link`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        memberships = data.memberships ?? []
        merged = data.merged_identity_count ?? 0
      }
    } catch {
      // Non-fatal — the password is set and the session is valid. Fall through to the dashboard,
      // which self-routes (onboarding / forbidden) if this person doesn't belong there.
    }

    const staff = memberships.find(m => m.roles.some(r => STAFF_ROLES.includes(r)))
    // On a studio's own subdomain, land on that studio's account page, not just the first one.
    const hereSlug = studioSlugFromHost(window.location.host)
    const memberOf = memberships.filter(m => m.roles.includes('member'))
    const memberArea = memberOf.find(m => m.slug === hereSlug) ?? memberOf[0]

    setDoneNote(merged > 0 ? 'Your existing studio account has been linked.' : '')
    setPhase('done')
    if (staff || !memberArea) {
      setTimeout(() => router.push('/dashboard'), 1200)
    } else {
      // May be another host (studio subdomain), so a full navigation rather than router.push.
      const target = studioUrl(memberArea.slug, '/account')
      setTimeout(() => { window.location.href = target }, 1200)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setMessage('')

    const problem = passwordProblem(password)
    if (problem) {
      setMessage(problem)
      return
    }
    if (password !== confirm) {
      setMessage('Passwords do not match.')
      return
    }

    setBusy(true)
    setOfferNewLink(false)
    const supabase = createClient()

    // Welcome / invite link: swap the long-lived invite for a fresh one-time token first.
    if (!verifiedRef.current && !pendingOtpRef.current && pendingInviteRef.current) {
      let res: Response
      try {
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/invites/redeem`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: pendingInviteRef.current }),
        })
      } catch {
        setMessage('Could not reach CalaStudio. Check your connection and try again.')
        setBusy(false)
        return
      }
      if (res.status === 410) {
        setPhase('claimed')
        setBusy(false)
        return
      }
      if (!res.ok) {
        setMessage(res.status === 429
          ? 'Too many attempts. Please wait a minute and try again.'
          : "This link isn't valid any more. Ask your studio to resend your welcome email, or get a new link below.")
        setOfferNewLink(res.status !== 429)
        setBusy(false)
        return
      }
      const data: { token_hash: string; type: string } = await res.json()
      pendingOtpRef.current = { tokenHash: data.token_hash, type: data.type as EmailOtpType }
    }

    // Establish the session from the emailed token — only here (a real click), and only once, so a
    // link scanner that merely loads the page can't consume the single-use token. On a retry after
    // a later step failed, the session already exists; don't re-verify a spent token.
    if (!verifiedRef.current && pendingOtpRef.current) {
      const { tokenHash, type } = pendingOtpRef.current
      const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      if (otpError) {
        const dead = /expired|invalid|not found/i.test(otpError.message)
        // A token minted from an invite just now can't be stale — let the next try mint another.
        if (pendingInviteRef.current) pendingOtpRef.current = null
        setMessage(dead
          ? "This link has expired or has already been used. Get a new one below."
          : otpError.message)
        setOfferNewLink(dead)
        setBusy(false)
        return
      }
      verifiedRef.current = true
    }

    const { data, error } = await supabase.auth.updateUser({ password })

    if (error || !data.user) {
      setMessage(authErrorMessage(error, 'Could not set your password. Please try again.'))
      setBusy(false)
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setMessage('Your password was set — please sign in to continue.')
      setBusy(false)
      setTimeout(() => router.push('/login'), 1500)
      return
    }

    await routeOnward(session.access_token)
    setBusy(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f4f4f4'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '48px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-block',
            backgroundColor: '#085041',
            color: 'white',
            fontWeight: 700,
            fontSize: '20px',
            padding: '8px 20px',
            borderRadius: '8px',
            marginBottom: '16px'
          }}>
            CalaStudio
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#1a1a1a' }}>
            Set your password
          </h1>
          <p style={{ color: '#666', marginTop: '8px', fontSize: '14px' }}>
            Choose a password to finish setting up your account
          </p>
        </div>

        {phase === 'checking' ? (
          <p style={{ textAlign: 'center', fontSize: '14px', color: '#666' }}>Loading...</p>
        ) : phase === 'no-session' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: '#fdecea',
              color: '#8b1a1a',
              fontSize: '14px',
              textAlign: 'center'
            }}>
              {linkError?.code === 'otp_expired'
                ? 'This link has expired or has already been used. A password link only works once and for a limited time — ask your studio to send a fresh one.'
                : linkError?.description
                  ? linkError.description
                  : 'Open this page from the link in your welcome or password-reset email. If your link has expired, request a new one below.'}
            </div>
            {linkError?.code && linkError.code !== 'otp_expired' && (
              <p style={{ textAlign: 'center', fontSize: '12px', color: '#999' }}>
                Reference: {linkError.code}
              </p>
            )}
            <p style={{ textAlign: 'center', fontSize: '14px', color: '#666' }}>
              <Link href="/forgot-password" style={{ color: '#085041', fontWeight: 500 }}>
                Email me a new link
              </Link>
            </p>
          </div>
        ) : phase === 'claimed' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: '#e8f5ee',
              color: '#085041',
              fontSize: '14px',
              textAlign: 'center'
            }}>
              Your account is already set up. Sign in with your email and password.
            </div>
            <Link href="/login" style={{
              display: 'block',
              textAlign: 'center',
              padding: '12px',
              backgroundColor: '#085041',
              color: 'white',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 600,
              textDecoration: 'none'
            }}>
              Sign in
            </Link>
            <p style={{ textAlign: 'center', fontSize: '14px', color: '#666' }}>
              Forgot your password?{' '}
              <Link href="/forgot-password" style={{ color: '#085041', fontWeight: 500 }}>
                Email me a reset link
              </Link>
            </p>
          </div>
        ) : phase === 'done' ? (
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: '#e8f5ee',
            color: '#085041',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            Password set. Taking you in…{doneNote ? ` ${doneNote}` : ''}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#1a1a1a' }}>
                Password
              </label>
              <PasswordInput
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #e2e2e2',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#1a1a1a' }}>
                Confirm password
              </label>
              <PasswordInput
                placeholder="Re-enter your password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid #e2e2e2',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
            </div>

            {confirm.length >= password.length && confirm.length > 0 && password !== confirm && (
              <p style={{ fontSize: '13px', color: '#8b1a1a', margin: 0 }}>
                The two passwords are different — tap the eye to check what you typed.
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: busy ? '#9fd6b8' : '#085041',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: busy ? 'not-allowed' : 'pointer',
                marginTop: '8px'
              }}
            >
              {busy ? 'Setting up…' : 'Set password and continue'}
            </button>

            {message && (
              <div style={{
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: '#fdecea',
                color: '#8b1a1a',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                {message}
              </div>
            )}
            {message && offerNewLink && (
              <p style={{ textAlign: 'center', fontSize: '14px', color: '#666', margin: 0 }}>
                <Link href="/forgot-password" style={{ color: '#085041', fontWeight: 500 }}>
                  Email me a new link
                </Link>
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
