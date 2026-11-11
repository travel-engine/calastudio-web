'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import StripePaymentForm from './StripePaymentForm'
import styles from './photofirst.module.css'
import { studioPath } from '@/lib/seo'
import { dateOnlyLabel, localDateKey, periodUnit, priceLabel, type MembershipQuote, type MembershipTemplate } from '@/lib/memberships'

const money = (n: number, c: string) => {
  try { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: c }).format(n) }
  catch { return `${c} ${n.toFixed(2)}` }
}

// How far ahead a member can pick a start date (the API's limit).
const MAX_DAYS_AHEAD = 60

type Phase = 'choose' | 'starting' | 'pay' | 'confirming' | 'done' | 'pending' | 'error'

// Buy a membership: pick a start date → quote (first period, next charge, tax) → PaymentIntent →
// PaymentElement → poll My memberships until the webhook has created it. The first period is paid
// now; the API saves the card for renewals. Prices and dates all come from the quote.
export default function MembershipPurchaseModal({
  template, orgId, token, studioSlug, stripeAccountId, onClose, onPurchased,
}: {
  template: MembershipTemplate
  orgId: string
  token: string
  studioSlug: string
  stripeAccountId: string
  onClose: () => void
  onPurchased: () => void
}) {
  const base = `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/members/me/memberships`
  const fixed = template.period_type === 'fixed_dates'
  const [startDate, setStartDate] = useState(localDateKey())
  const [quote, setQuote] = useState<MembershipQuote | null>(null)
  const [quoteError, setQuoteError] = useState('')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('choose')
  const [error, setError] = useState('')
  const idsBefore = useRef<Set<string>>(new Set())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Re-quote whenever the start date changes.
  useEffect(() => {
    if (!startDate && !fixed) return
    let active = true
    setQuote(null)
    setQuoteError('')
    const qs = fixed ? '' : `?start_date=${startDate}`
    fetch(`${base}/${template.id}/quote${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async res => {
        const data = await res.json().catch(() => null)
        if (!active) return
        if (res.ok) setQuote(data)
        else setQuoteError(res.status === 404 && !data?.error
          ? "You're not a member of this studio yet. Join from your account, then come back."
          : data?.error ?? 'Could not price this membership. Please try again.')
      })
      .catch(() => { if (active) setQuoteError('Could not reach the server. Please try again.') })
    return () => { active = false }
  }, [base, template.id, token, startDate, fixed])

  const startPayment = async () => {
    setPhase('starting')
    setError('')
    try {
      const listRes = await fetch(base, { headers: { Authorization: `Bearer ${token}` } })
      if (listRes.ok) idsBefore.current = new Set((await listRes.json()).map((m: { id: string }) => m.id))
      const res = await fetch(`${base}/${template.id}/payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(fixed ? {} : { start_date: startDate }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(res.status === 409
          ? "This studio can't take card payments right now."
          : data?.error ?? 'Could not start the purchase. Please try again.')
        setPhase('error')
        return
      }
      setClientSecret(data.client_secret)
      setPhase('pay')
    } catch {
      setError('Could not reach the server. Please try again.')
      setPhase('error')
    }
  }

  // The webhook creates the membership a beat after the charge confirms — poll briefly.
  const pollForMembership = async () => {
    setPhase('confirming')
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1500))
      const res = await fetch(base, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
      if (res?.ok) {
        const list: { id: string; template_id: string }[] = await res.json()
        if (list.some(m => m.template_id === template.id && !idsBefore.current.has(m.id))) { setPhase('done'); return }
      }
    }
    setPhase('pending')
  }

  const total = quote ? money(quote.price, quote.currency) : null
  const startsToday = quote?.start_date === localDateKey()

  return (
    <div onClick={onClose} className={styles.modalOverlay}>
      <div onClick={e => e.stopPropagation()} className={styles.modalPanel} role="dialog" aria-modal="true" aria-labelledby="membership-purchase-title">
        <div className={styles.drawerHead} style={{ marginBottom: '18px' }}>
          <div style={{ minWidth: 0 }}>
            <div id="membership-purchase-title" className={styles.drawerTitle}>{template.name}</div>
            <div className={styles.drawerMeta}>{priceLabel(template, money)}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className={styles.iconClose}>✕</button>
        </div>

        {phase === 'choose' && (
          <div>
            {!fixed && (
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="membership-start" className={styles.fieldLabel}>Start date</label>
                <input
                  id="membership-start" type="date" className={styles.inputRect}
                  value={startDate} min={localDateKey()} max={localDateKey(MAX_DAYS_AHEAD)}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
            )}

            {quoteError ? (
              <div className={styles.noticeError}>{quoteError}</div>
            ) : !quote ? (
              <div className={styles.drawerStatus}>Working out your dates…</div>
            ) : (
              <>
                <ul className={styles.metaList} style={{ marginBottom: '18px' }}>
                  <li>
                    {startsToday ? 'Starts today' : `Starts ${dateOnlyLabel(quote.start_date)}`}
                    {quote.first_period_end && <>, first period until {dateOnlyLabel(quote.first_period_end)}</>}
                  </li>
                  <li>
                    Pay {total} now{quote.tax_amount > 0 && <> (includes {money(quote.tax_amount, quote.currency)} {quote.tax_name ?? 'tax'})</>}
                  </li>
                  {quote.renews && quote.next_charge_on
                    ? <li>Then {total} on {dateOnlyLabel(quote.next_charge_on)}, and every {periodUnit(template.period_type, template.period_rolling_value)} after that until you cancel</li>
                    : <li>One payment, no renewal</li>}
                </ul>
                <button onClick={startPayment} className={styles.blockBtn}>Continue to payment</button>
                {quote.renews && (
                  <p className={styles.drawerFootnote}>
                    Your card is saved for renewals. Cancel any time from your account; you keep access until the end of the period you&apos;ve paid for.
                  </p>
                )}
              </>
            )}
            {quoteError.startsWith("You're not a member") && (
              <Link href={studioPath(studioSlug, '/account')} className={styles.smallBtn} style={{ marginTop: '14px' }}>
                Go to your account
              </Link>
            )}
          </div>
        )}

        {phase === 'starting' && <div className={styles.drawerStatus}>Setting up…</div>}

        {phase === 'error' && (
          <div>
            <div className={styles.noticeError} style={{ marginBottom: 0 }}>{error}</div>
            <button onClick={() => setPhase('choose')} className={styles.smallBtn} style={{ marginTop: '14px' }}>Back</button>
          </div>
        )}

        {phase === 'pay' && clientSecret && (
          <StripePaymentForm
            clientSecret={clientSecret}
            stripeAccountId={stripeAccountId}
            submitLabel={`Pay ${total ?? ''}`.trim()}
            onSuccess={pollForMembership}
            onError={m => { setError(m); setPhase('error') }}
          />
        )}

        {phase === 'confirming' && <div className={styles.drawerStatus}>Confirming your payment…</div>}

        {phase === 'done' && (
          <div className={styles.resultWrap}>
            <div className={`${styles.resultCircle} ${styles.resultCircleSolid}`}>✓</div>
            <div className={styles.resultTitle}>You&apos;re a member</div>
            <p className={styles.drawerText}>
              {quote && !startsToday ? `Your membership starts ${dateOnlyLabel(quote.start_date)}.` : 'Your membership has started.'} We&apos;ve emailed your receipt.
            </p>
            <button onClick={onPurchased} className={styles.blockBtn}>Done</button>
          </div>
        )}

        {phase === 'pending' && (
          <div className={styles.resultWrap}>
            <div className={`${styles.resultCircle} ${styles.resultCircleSolid}`}>✓</div>
            <div className={styles.resultTitle}>Payment received</div>
            <p className={styles.drawerText}>
              Your membership is still being set up. It should appear in your account in a few minutes. If it isn&apos;t there by then, contact the studio. Your payment is safe.
            </p>
            <Link href={studioPath(studioSlug, '/account?tab=passes')} className={styles.blockBtn} style={{ display: 'block', textAlign: 'center' }}>
              Go to my account
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
