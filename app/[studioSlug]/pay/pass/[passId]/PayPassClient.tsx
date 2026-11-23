'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import styles from '../../../photofirst.module.css'
import StripePaymentForm from '../../../StripePaymentForm'
import { formatMoney } from '@/lib/money'
import { studioPath } from '@/lib/seo'

// GET  /api/public/{slug}/pass-payments/{passId}?t=…               (no auth) → status + amount
// POST /api/public/{slug}/pass-payments/{passId}/payment-intent?t=… (no auth) → client_secret
// The webhook marks the pass paid; this page polls the status afterwards to confirm.

interface PassPaymentInfo {
  status: 'unpaid' | 'paid' | 'unavailable'
  studio_name: string
  pass_name: string
  member_first_name: string | null
  amount: number
  currency: string
}

type Phase = 'loading' | 'expired' | 'unpaid' | 'starting' | 'pay' | 'confirming' | 'paid' | 'pending' | 'unavailable' | 'error'

export default function PayPassClient({ studioSlug, studioName, passId, token, stripeAccountId }: {
  studioSlug: string
  studioName: string
  passId: string
  token: string
  stripeAccountId: string | null
}) {
  const base = `${process.env.NEXT_PUBLIC_API_URL}/api/public/${encodeURIComponent(studioSlug)}/pass-payments/${passId}`
  const q = `?t=${encodeURIComponent(token)}`
  const [info, setInfo] = useState<PassPaymentInfo | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [justPaid, setJustPaid] = useState(false)
  const starting = useRef(false)

  const fetchInfo = useCallback(async (): Promise<PassPaymentInfo | null | 'expired'> => {
    if (!token) return 'expired'
    const res = await fetch(`${base}${q}`, { cache: 'no-store' }).catch(() => null)
    if (!res) return null
    if (res.status === 404) return 'expired'
    if (!res.ok) return null
    return res.json()
  }, [base, q, token])

  useEffect(() => {
    fetchInfo().then(r => {
      if (r === 'expired') { setPhase('expired'); return }
      if (!r) { setError("We couldn't load this payment. Please try again in a moment."); setPhase('error'); return }
      setInfo(r)
      setPhase(r.status === 'paid' ? 'paid' : r.status === 'unavailable' || !stripeAccountId ? 'unavailable' : 'unpaid')
    })
  }, [fetchInfo, stripeAccountId])

  const start = async () => {
    if (starting.current) return
    starting.current = true
    setPhase('starting')
    setError('')
    try {
      const res = await fetch(`${base}/payment-intent${q}`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (res.status === 409 && data?.code === 'already_paid') { setPhase('paid'); return }
      if (res.status === 409 && data?.code === 'stripe_unavailable') { setPhase('unavailable'); return }
      if (res.status === 404) { setPhase('expired'); return }
      if (!res.ok || !data?.client_secret) { setError(data?.error || "Couldn't start the payment. Please try again."); setPhase('unpaid'); return }
      setClientSecret(data.client_secret)
      setPhase('pay')
    } catch {
      setError("Couldn't reach the server. Please try again.")
      setPhase('unpaid')
    } finally {
      starting.current = false
    }
  }

  // The webhook records the payment a moment after the card confirms; wait for it before saying "paid".
  const confirm = async () => {
    setPhase('confirming')
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1500))
      const r = await fetchInfo()
      if (r && r !== 'expired' && r.status === 'paid') { setJustPaid(true); setPhase('paid'); return }
    }
    setPhase('pending')
  }

  const amount = info ? formatMoney(info.amount, info.currency) : ''
  const name = info?.studio_name || studioName

  return (
    <div className={styles.modalPanel} style={{ maxHeight: 'none' }}>
      {phase === 'loading' && <div className={styles.drawerStatus}>Loading…</div>}

      {phase === 'expired' && (
        <>
          <h1 className={styles.drawerTitle} style={{ margin: '0 0 8px' }}>This link has expired</h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: 'var(--text-body)' }}>
            Ask {name} to send you a new payment link. You can reply to their email.
          </p>
        </>
      )}

      {phase === 'error' && <div className={styles.noticeError} style={{ marginBottom: 0 }}>{error}</div>}

      {info && phase !== 'expired' && phase !== 'error' && phase !== 'loading' && (
        <>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, color: 'var(--text-meta)', marginBottom: 4 }}>{name}</div>
            <h1 className={styles.drawerTitle} style={{ margin: 0 }}>{info.pass_name}</h1>
            <div className={styles.drawerMeta}>{amount}</div>
          </div>

          {phase === 'paid' && (
            <div className={styles.noticeOk} style={{ marginBottom: 0, fontSize: 15 }}>
              {justPaid
                ? <>Thank you{info.member_first_name ? `, ${info.member_first_name}` : ''}! Your payment of {amount} has gone through. A receipt is on its way to your email.</>
                : <>This pass has already been paid for. There&rsquo;s nothing more to do.</>}
            </div>
          )}

          {phase === 'unavailable' && (
            <div className={styles.noticeError} style={{ marginBottom: 0 }}>
              Card payments aren&rsquo;t available for this pass right now. Please contact {name}.
            </div>
          )}

          {(phase === 'unpaid' || phase === 'starting') && (
            <>
              <p style={{ margin: '0 0 16px', fontSize: 15, lineHeight: 1.5, color: 'var(--text-body)' }}>
                {info.member_first_name ? `Hi ${info.member_first_name}, ` : ''}{name} has added this pass to your account. You can
                already book classes with it; pay here by card whenever you&rsquo;re ready.
              </p>
              {error && <div className={styles.noticeError}>{error}</div>}
              <button type="button" className={styles.blockBtn} onClick={start} disabled={phase === 'starting'}>
                {phase === 'starting' ? 'Setting up…' : `Pay ${amount}`}
              </button>
            </>
          )}

          {phase === 'pay' && clientSecret && stripeAccountId && (
            <StripePaymentForm
              clientSecret={clientSecret}
              stripeAccountId={stripeAccountId}
              submitLabel={`Pay ${amount}`}
              onSuccess={confirm}
              onError={m => { setError(m); setClientSecret(null); setPhase('unpaid') }}
            />
          )}

          {phase === 'confirming' && <div className={styles.drawerStatus}>Confirming your payment…</div>}

          {phase === 'pending' && (
            <div className={styles.noticeOk} style={{ marginBottom: 0, fontSize: 15 }}>
              Your payment is being processed. It can take a minute to show; you&rsquo;ll get a receipt by email once it&rsquo;s done.
            </div>
          )}

          {(phase === 'paid' || phase === 'pending') && (
            <Link href={studioPath(studioSlug, '/schedule')} className={styles.blockBtn} style={{ marginTop: 16, display: 'block', textAlign: 'center' }}>
              Book a class
            </Link>
          )}
        </>
      )}
    </div>
  )
}
