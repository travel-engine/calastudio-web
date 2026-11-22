'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

// "We've updated our Terms": shown to a signed-in person whose accepted platform Terms version is
// older than the current one (Terms §7). The API decides who needs it (GET /api/me →
// terms_acceptance_required) and records acceptance (POST /api/me/accept-terms); this only renders.
// Blocking until they accept or sign out. Someone who has never registered (no CalaStudio record yet)
// isn't asked here: registration and onboarding take acceptance as before.
//
// Mounted in the dashboard layout and the studio-site layout. Re-checks when someone signs in on the
// page (e.g. in the booking panel).

const API = process.env.NEXT_PUBLIC_API_URL

export default function TermsUpdatePrompt({ variant = 'app' }: { variant?: 'app' | 'studio' }) {
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const check = useCallback(async (accessToken: string | undefined) => {
    if (!accessToken) { setToken(null); return }
    const res = await fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => null)
    const me = res?.ok ? await res.json().catch(() => null) : null
    setToken(me?.terms_acceptance_required === true ? accessToken : null)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => check(session?.access_token))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') check(session?.access_token)
    })
    return () => subscription.unsubscribe()
  }, [check])

  if (!token) return null

  const accept = async () => {
    setBusy(true)
    setError('')
    const res = await fetch(`${API}/api/me/accept-terms`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
    if (res?.ok) { setToken(null); return }
    setError('Something went wrong. Please try again.')
    setBusy(false)
  }

  const signOut = async () => {
    setBusy(true)
    await createClient().auth.signOut()
    window.location.reload()
  }

  const studio = variant === 'studio'
  const ink = studio ? 'var(--ink, #1a1a1a)' : '#1a1a1a'
  const muted = studio ? 'var(--text-meta, #555)' : '#555'
  const accent = studio ? 'var(--accent-text, #085041)' : '#085041'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="terms-update-title" style={{
        width: '100%', maxWidth: 440, borderRadius: studio ? 'var(--radius-drawer, 16px)' : 12, padding: 24,
        background: studio ? 'var(--surface, #fff)' : '#fff', color: ink, fontFamily: 'inherit',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
      }}>
        <h2 id="terms-update-title" style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 700 }}>We&rsquo;ve updated our Terms</h2>
        <p style={{ margin: '0 0 8px', fontSize: 15, lineHeight: 1.5, color: muted }}>
          CalaStudio&rsquo;s Terms &amp; Conditions have changed since you last accepted them. Please read
          them and accept to keep using your account.
        </p>
        <p style={{ margin: '0 0 20px', fontSize: 15 }}>
          <a href="/terms" target="_blank" rel="noopener" style={{ color: accent, fontWeight: 600 }}>Read the Terms &amp; Conditions</a>
        </p>
        {error && <p role="alert" style={{ margin: '0 0 12px', fontSize: 14, color: studio ? 'var(--danger, #8b1a1a)' : '#8b1a1a' }}>{error}</p>}
        <button type="button" onClick={accept} disabled={busy} style={{
          width: '100%', minHeight: 48, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
          borderRadius: studio ? 'var(--pill, 999px)' : 8,
          background: studio ? 'var(--accent, #085041)' : '#085041', color: studio ? 'var(--accent-ink, #fff)' : '#fff',
          opacity: busy ? 0.7 : 1,
        }}>
          {busy ? 'Saving…' : 'I accept'}
        </button>
        <button type="button" onClick={signOut} disabled={busy} style={{
          width: '100%', marginTop: 8, minHeight: 44, border: 'none', background: 'none', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 14, color: muted, textDecoration: 'underline',
        }}>
          Sign out
        </button>
      </div>
    </div>
  )
}
