'use client'

import { useEffect, useState } from 'react'
import { color } from '@/lib/ui/tokens'
import { Button, CheckRow, FormField, TextArea, TextInput, alertStyle } from '@/app/components/admin'

// The "Send welcome emails" step for imported members: the studio's own message and sign-off. Saved on the studio by the API, so they're pre-filled next
// time and used by later sends. The API builds each member's email: their message, a Set your
// password button (plus Forgot password / Continue with Google), their carried-over credits (or a
// "nothing to carry over" line) and the sign-off, and (optionally, on by default) a copy of each
// email to the studio, without the member's sign-in link. Used by the import dialog and the Members banner.

const MESSAGE_MAX = 1000
const SIGN_OFF_MAX = 60
const DEFAULT_MESSAGE = "Good news: we've moved you across to our new booking system, CalaStudio."

export default function WelcomeEmailForm({ api, pendingCount, studioName, onSent, onCancel }: {
  api: (path: string, init?: RequestInit) => Promise<Response>
  /** How many are waiting, when the caller already knows; otherwise read from the API. */
  pendingCount?: number
  studioName?: string
  onSent: (queued: number) => void
  onCancel?: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  const [count, setCount] = useState<number | null>(pendingCount ?? null)
  const [message, setMessage] = useState('')
  const [signOff, setSignOff] = useState('')
  const [copy, setCopy] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    api('/members/pending-welcome-count')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (cancelled || !d) return
        if (pendingCount === undefined) setCount(d.count ?? 0)
        setMessage(d.message ?? '')
        setSignOff(d.sign_off ?? '')
        // Never sent with a message before: a copy by default. Afterwards, keep the studio's choice.
        setCopy(d.message == null && d.sign_off == null ? true : d.copy_to_studio === true)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const send = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await api('/members/send-pending-welcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() || null, sign_off: signOff.trim() || null, copy_to_studio: copy }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error || "Couldn't send the welcome emails. Please try again.")
        return
      }
      onSent((await res.json()).queued ?? 0)
    } catch {
      setError("Couldn't send the welcome emails. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const n = count ?? 0
  const label = count === null ? 'Send welcome emails' : `Send ${n} welcome email${n === 1 ? '' : 's'}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <p style={{ margin: '0 0 16px', fontSize: 15, lineHeight: 1.5, color: color.ink2 }}>
        Each member gets their own email from {studioName || 'your studio'}, with your message, a button to set
        their password (or use Forgot password or Continue with Google), the class credits carried over for them,
        and your sign-off. Replies come to you.
      </p>

      <FormField label="Your message" hint={`Blank lines start a new paragraph. Leave it empty to use: “${DEFAULT_MESSAGE}”`}>
        <TextArea value={message} onChange={e => setMessage(e.target.value)} maxLength={MESSAGE_MAX} rows={5}
          placeholder={DEFAULT_MESSAGE} disabled={!loaded} />
      </FormField>

      <FormField label="Sign-off" hint={`Shown after “See you on the mat,”. Leave empty to use ${studioName ? `“${studioName}”` : 'your studio name'}.`}>
        <TextInput value={signOff} onChange={e => setSignOff(e.target.value)} maxLength={SIGN_OFF_MAX}
          placeholder={studioName || 'e.g. Ravi'} disabled={!loaded} />
      </FormField>

      <CheckRow checked={copy} onChange={setCopy}>
        Email me a copy of each welcome (without the member&rsquo;s personal sign-in link)
        {copy && n > 1 && <span style={{ display: 'block', fontSize: 13, color: color.muted }}>That&rsquo;s {n} copies to your studio email.</span>}
      </CheckRow>

      {error && <div role="alert" style={{ ...alertStyle('danger'), marginTop: 12 }}>{error}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
        <Button variant="primary" onClick={send} disabled={busy || !loaded || count === 0}>
          {busy ? 'Sending…' : label}
        </Button>
        {onCancel && <Button onClick={onCancel} disabled={busy}>Not now</Button>}
      </div>
    </div>
  )
}
