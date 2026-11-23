'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { formatMoney } from '@/lib/money'
import { formatShortDate } from '@/lib/dates'
import { color, radius } from '@/lib/ui/tokens'
import { Button, Chip, controlStyle } from '@/app/components/admin'

// The "Unpaid" strip under a pass that was added as pay-later (Momoyoga style): the member can already
// book with it. Staff either mark it paid (cash, bank transfer, gift, card in person) or email a
// payment reminder with a Stripe pay link (also shown here to copy into an SMS). The API records the
// payment and decides what's allowed; this only renders the actions.

const MARK_PAID_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'credit_card', label: 'Credit card (in person)' },
  { value: 'debit_card', label: 'Debit card (in person)' },
  { value: 'gift', label: 'Gift card' },
]

export default function UnpaidPassActions({ api, passId, passName, amount, currency, reason, reminderSentAt, timeZone, canMarkPaid, canRemind, onChanged }: {
  api: (path: string, init?: RequestInit) => Promise<Response>
  passId: string
  passName: string
  amount: number
  currency: string
  reason: string | null
  reminderSentAt: string | null
  timeZone?: string | null
  canMarkPaid: boolean
  canRemind: boolean
  onChanged: (message: string) => void
}) {
  const [marking, setMarking] = useState(false)
  const [method, setMethod] = useState('')
  const [busy, setBusy] = useState<'' | 'paid' | 'remind'>('')
  const [error, setError] = useState('')
  const [payUrl, setPayUrl] = useState('')
  const [sentAt, setSentAt] = useState(reminderSentAt)
  const [copied, setCopied] = useState(false)
  const price = formatMoney(amount, currency)

  const errorFor = (code: string | undefined, fallback: string) =>
    code === 'already_paid' ? 'This pass has already been paid.'
      : code === 'payment_in_progress' ? 'The member is paying online right now. Check again in a few minutes.'
        : code === 'stripe_unavailable' ? "Your studio isn't connected to Stripe, so a card payment link can't be sent. Mark it paid instead."
          : code === 'not_unpaid' ? "This pass isn't waiting for payment."
            : code === 'unavailable' ? 'This pass was refunded, so it can no longer be paid.'
              : code === 'send_failed' ? "The reminder email couldn't be sent. Please try again in a few minutes."
                : code === 'payment_method_required' ? 'Choose how it was paid.'
                  : code === 'forbidden' ? "You don't have permission to do this."
                    : fallback

  const markPaid = async () => {
    if (!method) { setError('Choose how it was paid.'); return }
    setBusy('paid')
    setError('')
    try {
      const res = await api(`/member-passes/${passId}/mark-paid`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payment_method: method }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(errorFor(data?.code, data?.error || "Couldn't mark it paid. Please try again.")); return }
      onChanged(`${passName} marked as paid (${price}).`)
    } catch {
      setError("Couldn't reach the server. Please try again.")
    } finally {
      setBusy('')
    }
  }

  const remind = async () => {
    setBusy('remind')
    setError('')
    try {
      const res = await api(`/member-passes/${passId}/payment-reminder`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(errorFor(data?.code, data?.error || "Couldn't send the reminder. Please try again.")); return }
      setSentAt(data?.sent_at ?? new Date().toISOString())
      setPayUrl(data?.pay_url ?? '')
    } catch {
      setError("Couldn't reach the server. Please try again.")
    } finally {
      setBusy('')
    }
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(payUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* selectable */ }
  }

  return (
    <div style={{ margin: '0 20px 14px', padding: '12px 14px', background: color.warnBg, borderRadius: radius.control, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px' }}>
        <Chip tone="warn">Unpaid · {price}</Chip>
        {reason && <span style={{ fontSize: 14, color: color.ink2 }}>{reason}</span>}
        {sentAt && <span style={{ fontSize: 13, color: color.muted }}>Reminder sent {formatShortDate(sentAt, timeZone)}</span>}
      </div>

      {(canMarkPaid || canRemind) && !marking && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {canMarkPaid && <Button size="sm" onClick={() => { setMarking(true); setError('') }} disabled={!!busy}>Mark as paid</Button>}
          {canRemind && (
            <Button size="sm" onClick={remind} disabled={!!busy}>
              {busy === 'remind' ? 'Sending…' : sentAt ? 'Send reminder again' : 'Send payment reminder'}
            </Button>
          )}
        </div>
      )}

      {canMarkPaid && marking && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <select aria-label="How was it paid?" value={method} onChange={e => setMethod(e.target.value)} style={{ ...controlStyle, width: 'auto', minWidth: 200 }}>
            <option value="">How was it paid?</option>
            {MARK_PAID_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <Button size="sm" variant="primary" onClick={markPaid} disabled={busy === 'paid'}>{busy === 'paid' ? 'Saving…' : `Record ${price} paid`}</Button>
          <Button size="sm" onClick={() => { setMarking(false); setError('') }} disabled={busy === 'paid'}>Cancel</Button>
        </div>
      )}

      {payUrl && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, color: color.ink2 }}>Emailed. You can also send this link by text:</span>
          <code style={{ padding: '6px 10px', background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.control, fontSize: 13, userSelect: 'all', wordBreak: 'break-all' }}>{payUrl}</code>
          <Button size="sm" onClick={copy}>{copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />} {copied ? 'Copied' : 'Copy link'}</Button>
        </div>
      )}

      {error && <div role="alert" style={{ fontSize: 14, color: color.dangerInk }}>{error}</div>}
    </div>
  )
}
