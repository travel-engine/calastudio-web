'use client'

import { useState } from 'react'
import styles from '../photofirst.module.css'
import StripePaymentForm from '../StripePaymentForm'
import { formatMoney } from '@/lib/money'

// "Unpaid · A$40.00 · Pay now" on a pass the studio added as pay-later (My passes). The member can
// already book with it; this lets them pay by card here instead of from the reminder email.
// POST /members/me/member-passes/{id}/payment-intent → PaymentElement; the webhook marks it paid,
// so afterwards we reload the passes until it shows paid.

export default function UnpaidPassPay({ api, studioSlug, passId, amount, currency, onPaid }: {
  api: (path: string, init?: RequestInit) => Promise<Response>
  studioSlug: string
  passId: string
  amount: number
  currency: string
  onPaid: () => Promise<boolean>
}) {
  const [phase, setPhase] = useState<'idle' | 'starting' | 'pay' | 'confirming' | 'pending'>('idle')
  const [clientSecret, setClientSecret] = useState('')
  const [account, setAccount] = useState('')
  const [error, setError] = useState('')
  const price = formatMoney(amount, currency)

  const start = async () => {
    setPhase('starting')
    setError('')
    try {
      const [orgRes, res] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/public/${studioSlug}`),
        api(`/members/me/member-passes/${passId}/payment-intent`, { method: 'POST' }),
      ])
      const org = orgRes.ok ? await orgRes.json() : null
      const data = await res.json().catch(() => null)
      if (res.status === 409 && data?.code === 'already_paid') { await onPaid(); return }
      if (!res.ok || !data?.client_secret || !org?.stripe_account_id) {
        setError(data?.code === 'stripe_unavailable' || (res.ok && !org?.stripe_account_id)
          ? "Card payments aren't available right now. Please pay the studio directly."
          : data?.error || "Couldn't start the payment. Please try again.")
        setPhase('idle')
        return
      }
      setAccount(org.stripe_account_id)
      setClientSecret(data.client_secret)
      setPhase('pay')
    } catch {
      setError("Couldn't reach the server. Please try again.")
      setPhase('idle')
    }
  }

  const confirm = async () => {
    setPhase('confirming')
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1500))
      if (await onPaid()) return
    }
    setPhase('pending')
  }

  return (
    <div style={{ borderTop: '1px solid var(--line)', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15, color: 'var(--ink)' }}>
          <strong>Unpaid</strong> · {price}
          <span style={{ display: 'block', fontSize: 13, color: 'var(--text-meta)' }}>You can already book with this pass.</span>
        </span>
        {(phase === 'idle' || phase === 'starting') && (
          <button type="button" className={styles.smallBtn} onClick={start} disabled={phase === 'starting'}>
            {phase === 'starting' ? 'Setting up…' : `Pay ${price}`}
          </button>
        )}
      </div>
      {error && <div className={styles.noticeError} style={{ marginBottom: 0 }}>{error}</div>}
      {phase === 'pay' && clientSecret && account && (
        <StripePaymentForm clientSecret={clientSecret} stripeAccountId={account} submitLabel={`Pay ${price}`}
          onSuccess={confirm} onError={m => { setError(m); setPhase('idle') }} />
      )}
      {phase === 'confirming' && <div className={styles.drawerStatus} style={{ padding: '8px 0' }}>Confirming your payment…</div>}
      {phase === 'pending' && (
        <div className={styles.noticeOk} style={{ marginBottom: 0 }}>
          Your payment is being processed. It can take a minute to show; you&rsquo;ll get a receipt by email.
        </div>
      )}
    </div>
  )
}
