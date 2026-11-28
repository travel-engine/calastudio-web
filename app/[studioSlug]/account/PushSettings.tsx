'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff, Share, X } from 'lucide-react'
import {
  type PushPreferences, type PushPrefKey, type PushSupport,
  currentSubscription, fetchPublicKey, permission, pushSupport, rememberPushOrg,
  subscribeDevice, subscriptionBody, unsubscribeDevice,
} from '@/lib/push'

// Push notifications for the member (spec 07 §7.10).
//   variant="card":   the full settings on the Profile tab: turn on/off for this phone, and which kinds.
//   variant="prompt": a one-line nudge on Home until they turn it on or dismiss it.
// Hidden entirely when the API has no push key, or the studio has member push switched off.

const TYPES: { key: PushPrefKey; label: string; hint: string }[] = [
  { key: 'waitlist', label: 'A waitlist spot opens', hint: 'So you can claim it before it goes' },
  { key: 'reminders', label: 'Class reminders', hint: "Before each class you've booked" },
  { key: 'class_changes', label: 'Class cancelled or changed', hint: 'Time, teacher or cancellation' },
  { key: 'account', label: 'Passes and payments', hint: "Credits about to expire, a payment that didn't go through" },
]

const dismissKey = (slug: string) => `cs-push-prompt-dismissed:${slug}`

type Props = {
  variant: 'card' | 'prompt'
  api: (path: string, init?: RequestInit) => Promise<Response>
  apiUrl: string | undefined
  orgId: string
  studioSlug: string
  brand: string
}

type State =
  | { kind: 'loading' }
  | { kind: 'hidden' }
  | { kind: 'ready'; support: PushSupport; key: string; prefs: PushPreferences; subscribed: boolean; perm: NotificationPermission }

export default function PushSettings({ variant, api, apiUrl, orgId, studioSlug, brand }: Props) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [dismissed, setDismissed] = useState(false)

  const load = useCallback(async () => {
    if (!apiUrl) { setState({ kind: 'hidden' }); return }
    const support = pushSupport()
    if (support === 'unsupported') { setState({ kind: 'hidden' }); return }
    const [key, prefsRes] = await Promise.all([
      fetchPublicKey(apiUrl),
      api('/members/me/push-preferences').catch(() => null),
    ])
    if (!key || !prefsRes?.ok) { setState({ kind: 'hidden' }); return }
    const prefs: PushPreferences = await prefsRes.json()
    if (!prefs.studio_push_enabled) { setState({ kind: 'hidden' }); return }

    let subscribed = false
    if (support === 'supported' && permission() === 'granted') {
      const sub = await currentSubscription().catch(() => null)
      if (sub) {
        subscribed = true
        // Re-register quietly: keeps the API's copy current if the browser rotated the endpoint,
        // and moves a shared phone's subscription to whoever is signed in now.
        void api('/members/me/push-subscriptions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscriptionBody(sub)),
        }).catch(() => {})
        rememberPushOrg(studioSlug, orgId)
      }
    }
    setState({ kind: 'ready', support, key, prefs, subscribed, perm: permission() })
  }, [api, apiUrl, orgId, studioSlug])

  useEffect(() => {
    if (variant === 'prompt') {
      try { if (localStorage.getItem(dismissKey(studioSlug))) { setDismissed(true); setState({ kind: 'hidden' }); return } } catch { /* ignore */ }
    }
    void load()
  }, [load, variant, studioSlug])

  const turnOn = async () => {
    if (state.kind !== 'ready') return
    setBusy(true); setError('')
    try {
      const sub = await subscribeDevice(studioSlug, state.key)
      if (!sub) {
        setState({ ...state, perm: permission() })
        if (permission() !== 'denied') setError("Notifications weren't turned on.")
        return
      }
      const res = await api('/members/me/push-subscriptions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscriptionBody(sub)),
      })
      if (res.status === 409 || res.status === 404) {
        // 409: the studio switched member notifications off in the meantime. 404: not an active
        // member here, or push is off on this server. Either way there's nothing to turn on.
        await sub.unsubscribe().catch(() => {})
        setState({ kind: 'hidden' })
        return
      }
      if (!res.ok) {
        await sub.unsubscribe().catch(() => {})
        setError("Couldn't turn notifications on. Please try again.")
        return
      }
      const data: { preferences?: PushPreferences } = await res.json().catch(() => ({}))
      rememberPushOrg(studioSlug, orgId)
      setState({ ...state, subscribed: true, perm: 'granted', prefs: data.preferences ?? state.prefs })
    } catch {
      setError("Couldn't turn notifications on. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const turnOff = async () => {
    if (state.kind !== 'ready') return
    setBusy(true); setError('')
    await unsubscribeDevice(endpoint => api('/members/me/push-subscriptions/remove', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint }),
    }))
    setState({ ...state, subscribed: false })
    setBusy(false)
  }

  const toggle = async (key: PushPrefKey) => {
    if (state.kind !== 'ready') return
    const prev = state.prefs
    const next = { ...prev, [key]: !prev[key] }
    setState({ ...state, prefs: next })
    setError('')
    const res = await api('/members/me/push-preferences', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ waitlist: next.waitlist, reminders: next.reminders, class_changes: next.class_changes, account: next.account }),
    }).catch(() => null)
    if (res?.ok) {
      const saved: PushPreferences = await res.json().catch(() => next)
      setState(s => s.kind === 'ready' ? { ...s, prefs: saved } : s)
    } else {
      setState(s => s.kind === 'ready' ? { ...s, prefs: prev } : s)
      setError("Couldn't save that change. Please try again.")
    }
  }

  if (state.kind !== 'ready') return null

  // ---- Home nudge ----
  if (variant === 'prompt') {
    if (dismissed || state.subscribed || state.perm === 'denied') return null
    const dismiss = () => {
      setDismissed(true)
      try { localStorage.setItem(dismissKey(studioSlug), String(Date.now())) } catch { /* ignore */ }
    }
    return (
      <section style={{ ...cardStyle, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Bell size={20} style={{ color: brand, flexShrink: 0, marginTop: 2 }} aria-hidden />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>Get class reminders on this phone</div>
          {state.support === 'install-first' ? (
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-meta)', lineHeight: 1.45 }}>
              Add this app to your Home Screen first: tap <Share size={14} aria-label="Share" style={{ verticalAlign: '-2px' }} /> <strong>Share</strong>,
              then <strong>Add to Home Screen</strong>. Open it from there to turn on notifications.
            </p>
          ) : (
            <>
              <p style={{ margin: '4px 0 10px', fontSize: 14, color: 'var(--text-meta)', lineHeight: 1.45 }}>
                We&apos;ll let you know when a waitlist spot opens, before your classes, and if a class changes.
              </p>
              <button onClick={turnOn} disabled={busy} style={buttonStyle(brand, busy)}>
                {busy ? 'Turning on…' : 'Turn on notifications'}
              </button>
              {error && <div role="alert" style={{ marginTop: 8, fontSize: 14, color: 'var(--text-warn)' }}>{error}</div>}
            </>
          )}
        </div>
        <button onClick={dismiss} aria-label="Not now" style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'var(--text-meta)' }}>
          <X size={18} />
        </button>
      </section>
    )
  }

  // ---- Profile card ----
  return (
    <section style={{ ...cardStyle, padding: '24px 28px', marginTop: 16 }} aria-labelledby="push-heading">
      <h3 id="push-heading" style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Notifications</h3>

      {state.support === 'install-first' ? (
        <p style={pStyle}>
          To get notifications on an iPhone or iPad, add this app to your Home Screen: tap{' '}
          <Share size={14} aria-label="Share" style={{ verticalAlign: '-2px' }} /> <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
          Open it from there and turn them on here. You&apos;ll still get emails either way.
        </p>
      ) : state.perm === 'denied' ? (
        <p style={pStyle}>
          Notifications are blocked for this app. To get them, allow notifications for it in your phone or browser settings, then come back here.
        </p>
      ) : !state.subscribed ? (
        <>
          <p style={pStyle}>
            Get a notification on this phone when a waitlist spot opens, before your classes, and if a class changes. You&apos;ll still get emails too.
          </p>
          <button onClick={turnOn} disabled={busy} style={{ ...buttonStyle(brand, busy), marginTop: 12 }}>
            <Bell size={16} aria-hidden style={{ marginRight: 6, verticalAlign: '-3px' }} />
            {busy ? 'Turning on…' : 'Turn on notifications'}
          </button>
        </>
      ) : (
        <>
          <p style={pStyle}>On for this phone. Choose what you&apos;d like to hear about:</p>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
            {TYPES.map(t => (
              <label key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--line)', cursor: 'pointer' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{t.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-meta)' }}>{t.hint}</div>
                </div>
                <Switch on={state.prefs[t.key]} brand={brand} onChange={() => void toggle(t.key)} label={t.label} />
              </label>
            ))}
          </div>
          <button onClick={turnOff} disabled={busy}
            style={{ marginTop: 12, background: 'none', border: 'none', padding: 0, color: 'var(--text-meta)', fontSize: 14, cursor: 'pointer', textDecoration: 'underline' }}>
            <BellOff size={14} aria-hidden style={{ marginRight: 6, verticalAlign: '-2px' }} />
            Turn off on this phone
          </button>
          {isDevSite() && (
            <button onClick={() => void showTestButtons()}
              style={{ display: 'block', marginTop: 12, background: 'none', border: 'none', padding: 0, color: 'var(--text-meta)', fontSize: 14, cursor: 'pointer', textDecoration: 'underline' }}>
              Dev only: show a test notification with Yes/No buttons (in 5 seconds)
            </button>
          )}
        </>
      )}
      {error && <div role="alert" style={{ marginTop: 10, fontSize: 14, color: 'var(--text-warn)' }}>{error}</div>}
    </section>
  )
}

// Dev site only (never calastudio.app): preview how notification buttons look on this phone. Shown by
// the app's own service worker, so it looks exactly like a pushed one; the buttons just open pages.
function isDevSite() {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname
  return h === 'localhost' || h.endsWith('.dev.calastudio.app') || h === 'dev.calastudio.app'
}
async function showTestButtons() {
  const reg = await navigator.serviceWorker.ready
  const page = (q: string) => `${window.location.origin}${window.location.pathname}?${q}`
  setTimeout(() => {
    void reg.showNotification('Still coming to Saturday Vinyasa?', {
      body: 'Sat 7:00am · Yes keeps your spot, No cancels it (free until 8pm Friday)',
      tag: 'test-actions',
      data: { url: page('tab=home'), actionUrls: { yes: page('tab=home&still_coming=yes'), no: page('tab=home&still_coming=no') } },
      actions: [{ action: 'yes', title: "Yes, I'm coming" }, { action: 'no', title: 'No, cancel' }],
    } as NotificationOptions)
  }, 5000)
}

function Switch({ on, brand, onChange, label }: { on: boolean; brand: string; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label}
      onClick={e => { e.preventDefault(); onChange() }}
      style={{
        width: 44, height: 26, borderRadius: 13, border: 'none', padding: 3, cursor: 'pointer', flexShrink: 0,
        backgroundColor: on ? brand : 'var(--line)', transition: 'background-color 150ms',
      }}>
      <span style={{
        display: 'block', width: 20, height: 20, borderRadius: '50%', backgroundColor: 'white',
        transform: on ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 150ms', boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
      }} />
    </button>
  )
}

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface)', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
}
const pStyle: React.CSSProperties = { margin: '4px 0 0', fontSize: 15, color: 'var(--text-meta)', lineHeight: 1.5 }
const buttonStyle = (brand: string, busy: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 18px', border: 'none', borderRadius: 8,
  backgroundColor: brand, opacity: busy ? 0.6 : 1, color: 'white', fontSize: 14, fontWeight: 600, cursor: busy ? 'default' : 'pointer',
})
