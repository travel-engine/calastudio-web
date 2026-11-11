'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { isSessionExpiredByPolicy } from '@/lib/authRemember'
import { studioPath } from '@/lib/seo'
import { dateOnlyLabel, type MyMembership } from '@/lib/memberships'
import StripePaymentForm from '../../../../StripePaymentForm'
import styles from '../../../../photofirst.module.css'

const money = (n: number, c: string) => {
  try { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: c }).format(n) }
  catch { return `${c} ${n.toFixed(2)}` }
}

type Phase = 'loading' | 'signin' | 'nothing' | 'pay' | 'confirming' | 'done' | 'pending' | 'error'

// GET …/members/me/memberships/{id}/pay returns the overdue charge as a PaymentIntent (404 = nothing owed).
// After Stripe confirms, poll My memberships until the webhook has moved it out of past_due.
export default function MembershipPayClient({ studioSlug, orgId, membershipId, stripeAccountId }: {
  studioSlug: string
  orgId: string
  membershipId: string
  stripeAccountId: string | null
}) {
  const base = `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${orgId}/members/me/memberships`
  const accountHref = studioPath(studioSlug, '/account?tab=passes')
  const [phase, setPhase] = useState<Phase>('loading')
  const [token, setToken] = useState('')
  const [membership, setMembership] = useState<MyMembership | null>(null)
  const [charge, setCharge] = useState<{ client_secret: string; amount: number; currency: string } | null>(null)
  const [error, setError] = useState('')

  const fetchMembership = useCallback(async (t: string) => {
    const res = await fetch(base, { headers: { Authorization: `Bearer ${t}` } }).catch(() => null)
    if (!res?.ok) return null
    const list: MyMembership[] = await res.json()
    return list.find(m => m.id === membershipId) ?? null
  }, [base, membershipId])

  const load = useCallback(async (t: string) => {
    setPhase('loading')
    setError('')
    try {
      const [m, res] = await Promise.all([
        fetchMembership(t),
        fetch(`${base}/${membershipId}/pay`, { headers: { Authorization: `Bearer ${t}` } }),
      ])
      setMembership(m)
      if (res.status === 404) { setPhase('nothing'); return }
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(res.status === 409 ? "This studio can't take card payments right now." : data?.error ?? 'Could not load your payment. Please try again.')
        setPhase('error')
        return
      }
      setCharge(data)
      setPhase('pay')
    } catch {
      setError('Could not reach the server. Please try again.')
      setPhase('error')
    }
  }, [base, membershipId, fetchMembership])

  useEffect(() => {
    (async () => {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session || isSessionExpiredByPolicy()) { setPhase('signin'); return }
      setToken(session.access_token)
      load(session.access_token)
    })()
  }, [load])

  // The webhook clears past_due a beat after Stripe confirms.
  const pollUntilPaid = async () => {
    setPhase('confirming')
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1500))
      const m = await fetchMembership(token)
      if (m && m.status !== 'past_due') { setMembership(m); setPhase('done'); return }
    }
    setPhase('pending')
  }

  const backLink = (
    <Link href={accountHref} className={styles.blockBtn} style={{ display: 'block', textAlign: 'center' }}>
      Go to my membership
    </Link>
  )

  if (phase === 'loading') return <div className={styles.drawerStatus}>Loading…</div>

  if (phase === 'signin') return (
    <div>
      <p className={styles.drawerText}>Sign in to pay for your membership. Once you&apos;re signed in, use <strong>Pay now</strong> on your membership.</p>
      <Link href={studioPath(studioSlug, '/account')} className={styles.blockBtn} style={{ display: 'block', textAlign: 'center' }}>Sign in</Link>
    </div>
  )

  if (phase === 'nothing') return (
    <div>
      <div className={styles.noticeOk}>
        Nothing to pay{membership ? ` on your ${membership.name} membership` : ''}. You&apos;re all up to date.
      </div>
      {backLink}
    </div>
  )

  if (phase === 'error') return (
    <div>
      <div className={styles.noticeError}>{error}</div>
      <button onClick={() => load(token)} className={styles.smallBtn}>Try again</button>
    </div>
  )

  if (phase === 'done') return (
    <div className={styles.resultWrap}>
      <div className={`${styles.resultCircle} ${styles.resultCircleSolid}`}>✓</div>
      <div className={styles.resultTitle}>Paid, thank you</div>
      <p className={styles.drawerText}>
        Your membership is back up to date.
        {membership?.next_charge_on && <> Your next payment is on {dateOnlyLabel(membership.next_charge_on)}.</>}
        {' '}We&apos;ve emailed your receipt.
      </p>
      {backLink}
    </div>
  )

  if (phase === 'pending') return (
    <div className={styles.resultWrap}>
      <div className={`${styles.resultCircle} ${styles.resultCircleSolid}`}>✓</div>
      <div className={styles.resultTitle}>Payment received</div>
      <p className={styles.drawerText}>
        Your membership will show as paid in a few minutes. If it still says overdue after that, contact the studio. Your payment is safe.
      </p>
      {backLink}
    </div>
  )

  // pay / confirming
  const due = membership?.past_due
  return (
    <div>
      {membership && (
        <div className={styles.infoCard} style={{ marginBottom: '18px' }}>
          <div style={{ fontWeight: 700, fontSize: '17px' }}>{membership.name}</div>
          <ul className={styles.metaList} style={{ marginTop: '6px' }}>
            <li>Amount due {charge ? money(charge.amount, charge.currency) : ''}</li>
            {due?.since && <li>Overdue since {dateOnlyLabel(due.since)}</li>}
            {due?.grace_until && (due.can_book
              ? <li>You can keep booking until {dateOnlyLabel(due.grace_until)}</li>
              : <li>Booking is paused until it&apos;s paid</li>)}
          </ul>
        </div>
      )}
      {phase === 'confirming' ? (
        <div className={styles.drawerStatus}>Confirming your payment…</div>
      ) : charge && stripeAccountId ? (
        <>
          <StripePaymentForm
            clientSecret={charge.client_secret}
            stripeAccountId={stripeAccountId}
            submitLabel={`Pay ${money(charge.amount, charge.currency)}`}
            onSuccess={pollUntilPaid}
            onError={m => { setError(m); setPhase('error') }}
          />
          <p className={styles.drawerFootnote}>You can use a different card. It will be saved for your future payments.</p>
        </>
      ) : (
        <div className={styles.noticeError}>This studio can&apos;t take card payments right now.</div>
      )}
    </div>
  )
}
