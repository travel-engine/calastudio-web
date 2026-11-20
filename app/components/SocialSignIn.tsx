'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

// "Continue with Google / Apple" for members (studio sites, booking panel) and studios
// (calastudio.app login and sign-up). Supabase runs the provider round trip and sends the browser
// back to /auth/callback on the same host, which sets the session and redirects to `next`.
//
// Only providers switched on in Supabase (Auth → Providers) are shown, read from Supabase's public
// settings, so this is safe to ship before a provider is configured. Hidden inside the website
// widget: Google and Apple refuse to sign in within another site's iframe.
//
// Terms aren't skipped: members accept them in the booking panel's agreements step (the API's
// register call asks for them), studio owners in the onboarding wizard.

export type OAuthProvider = 'google' | 'apple'

const PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'apple', label: 'Continue with Apple' },
]

let enabledPromise: Promise<Set<OAuthProvider>> | null = null
function enabledProviders(): Promise<Set<OAuthProvider>> {
  enabledPromise ??= fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
  })
    .then(r => (r.ok ? r.json() : null))
    .then(s => new Set(PROVIDERS.map(p => p.id).filter(id => s?.external?.[id] === true)))
    .catch(() => new Set<OAuthProvider>())
  return enabledPromise
}

function isFramed() {
  try { return window.self !== window.top } catch { return true }
}

/** The person's name as the provider gave it (Google: full_name/name; Apple only on first sign-in). */
export function nameFromProviderMetadata(meta: Record<string, unknown> | undefined | null): string {
  if (!meta) return ''
  const str = (k: string) => (typeof meta[k] === 'string' ? (meta[k] as string).trim() : '')
  return str('full_name') || str('name') || [str('given_name'), str('family_name')].filter(Boolean).join(' ')
}

function ProviderMark({ id }: { id: OAuthProvider }) {
  if (id === 'google') {
    return (
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.87-.76-1.47.02-2.83.86-3.59 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.05 1.6 2.24 2.73 2.2 1.1-.05 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.4 1.2-2.46-.03-.01-2.3-.88-2.32-3.5zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.68-.92 2.67.97.08 1.96-.49 2.56-1.22z" />
    </svg>
  )
}

export default function SocialSignIn({ next, onBeforeRedirect, dividerLabel = 'or use your email', variant = 'app' }: {
  // Same-site path to land on after the provider sends the person back; defaults to this page.
  next?: string
  // Runs just before leaving the page (e.g. stash which class was being booked).
  onBeforeRedirect?: () => void
  dividerLabel?: string
  // 'app': calastudio.app pages (fixed colours). 'studio': studio sites (theme tokens).
  variant?: 'app' | 'studio'
}) {
  const [enabled, setEnabled] = useState<Set<OAuthProvider> | null>(null)
  const [busy, setBusy] = useState<OAuthProvider | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isFramed()) { setEnabled(new Set()); return }
    let cancelled = false
    enabledProviders().then(s => { if (!cancelled) setEnabled(s) })
    return () => { cancelled = true }
  }, [])

  const shown = PROVIDERS.filter(p => enabled?.has(p.id))
  if (shown.length === 0) return null

  const start = async (provider: OAuthProvider) => {
    if (busy) return
    setBusy(provider)
    setError('')
    onBeforeRedirect?.()
    const { error: err } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next ?? window.location.pathname)}` },
    })
    // On success the browser is already leaving for the provider.
    if (err) {
      setError(`Couldn't open ${provider === 'google' ? 'Google' : 'Apple'} sign-in. Please try again or use your email.`)
      setBusy(null)
    }
  }

  const studio = variant === 'studio'
  const button: React.CSSProperties = {
    width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: '10px 16px', borderRadius: studio ? 'var(--pill, 999px)' : 8, cursor: 'pointer',
    border: studio ? '1px solid var(--line-strong, #d0d0d0)' : '1px solid #d0d0d0',
    background: studio ? 'var(--surface, #fff)' : '#fff',
    color: studio ? 'var(--ink, #1a1a1a)' : '#1a1a1a',
    fontFamily: 'inherit', fontSize: 15, fontWeight: 600,
  }
  const muted = studio ? 'var(--text-meta, #666)' : '#666'
  const line = studio ? 'var(--line, #e2e2e2)' : '#e2e2e2'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {shown.map(p => (
        <button key={p.id} type="button" onClick={() => start(p.id)} disabled={!!busy} style={{ ...button, opacity: busy && busy !== p.id ? 0.6 : 1 }}>
          <ProviderMark id={p.id} />
          {busy === p.id ? 'Opening…' : p.label}
        </button>
      ))}
      {/* Apple's "Hide My Email" gives a relay address that can't match the email a studio has on
          file, so an existing member would land in a new, empty account. Members only. */}
      {studio && enabled?.has('apple') && (
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: muted }}>
          Already a member with Apple? Choose &ldquo;Share My Email&rdquo;, or use the email your studio has on file.
        </p>
      )}
      {error && <p role="alert" style={{ margin: 0, fontSize: 14, color: studio ? 'var(--danger, #8b1a1a)' : '#8b1a1a' }}>{error}</p>}
      <div aria-hidden style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '6px 0 2px', color: muted, fontSize: 13 }}>
        <span style={{ flex: 1, height: 1, background: line }} />
        {dividerLabel}
        <span style={{ flex: 1, height: 1, background: line }} />
      </div>
    </div>
  )
}
