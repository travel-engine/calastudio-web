'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import StripePaymentForm from './StripePaymentForm'
import type { PassTemplate } from './PricingList'
import styles from './photofirst.module.css'
import { studioPath } from '@/lib/seo'

const money = (n: number, c: string) => {
  try { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: c }).format(n) }
  catch { return `${c} ${n.toFixed(2)}` }
}

type Phase = 'loading' | 'pay' | 'confirming' | 'done' | 'pending' | 'error'

// Standalone pass purchase — the same PaymentIntent → PaymentElement → poll-for-issuance flow the
// booking drawer runs, lifted out so it works from the Pricing page (and, later, the account page)
// without an occurrence in scope.
export default function PassPurchaseModal({
  template, orgId, token, studioSlug, stripeAccountId, currency, onClose, onPurchased,
}: {
  template: PassTemplate
  orgId: string
  token: string
  studioSlug: string
  stripeAccountId: string
  currency: string
  brandColor?: string
  onClose: () => void
  onPurchased: () => void
}) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState('')
  const passIdsBefore = useRef<Set<string>>(new Set())
  const price = money(template.price, template.currency || currency)

  // Create the PaymentIntent once per open. React runs effects twice in development (and could
  // re-run them), and each run used to create its own PaymentIntent on the studio's Stripe account —
  // so the request is kept in a ref and every run waits on the same one.
  const intentRef = useRef<Promise<{ ok: true; clientSecret: string } | { ok: false; error: string }> | null>(null)
  useEffect(() => {
    let active = true
    if (!intentRef.current) {
      intentRef.current = (async () => {
        try {
          const listRes = await fetch(`${apiUrl}/api/organisations/${orgId}/members/me/passes`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (listRes.ok) {
            const list = await listRes.json()
            passIdsBefore.current = new Set(list.map((p: { id: string }) => p.id))
          }
          const res = await fetch(`${apiUrl}/api/organisations/${orgId}/members/me/passes/${template.id}/payment-intent`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          })
          const data = await res.json().catch(() => null)
          if (!res.ok) {
            return { ok: false as const, error: res.status === 404
              ? "You're not a member of this studio yet. Join from your account, then come back to buy a pass."
              : data?.error ?? 'Could not start the purchase. Please try again.' }
          }
          return { ok: true as const, clientSecret: data.client_secret as string }
        } catch {
          return { ok: false as const, error: 'Could not reach the server. Please try again.' }
        }
      })()
    }
    intentRef.current.then(r => {
      if (!active) return
      if (r.ok) { setClientSecret(r.clientSecret); setPhase('pay') }
      else { setError(r.error); setPhase('error') }
    })
    return () => { active = false }
  }, [apiUrl, orgId, token, template.id])

  // The webhook issues the pass a beat after the charge confirms — poll briefly, then stop nagging.
  const pollForPass = async () => {
    setPhase('confirming')
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1500))
      const res = await fetch(`${apiUrl}/api/organisations/${orgId}/members/me/passes`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const list = await res.json()
        const fresh = list.find((p: { id: string; pass_template_id: string }) =>
          p.pass_template_id === template.id && !passIdsBefore.current.has(p.id))
        if (fresh) { setPhase('done'); return }
      }
    }
    // Charged, but the pass hasn't shown up (the payment notification from Stripe is late or lost).
    // Say so honestly rather than claiming the pass is there.
    setPhase('pending')
  }

  return (
    <div onClick={onClose} className={styles.modalOverlay}>
      <div onClick={e => e.stopPropagation()} className={styles.modalPanel}>
        <div className={styles.drawerHead} style={{ marginBottom: '18px' }}>
          <div style={{ minWidth: 0 }}>
            <div className={styles.drawerTitle}>{template.name}</div>
            <div className={styles.drawerMeta}>{price}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className={styles.iconClose}>✕</button>
        </div>

        {phase === 'loading' && <div className={styles.drawerStatus}>Setting up…</div>}

        {phase === 'error' && (
          <div>
            <div className={styles.noticeError} style={{ marginBottom: 0 }}>{error}</div>
            {error.startsWith("You're not a member") && (
              <Link href={studioPath(studioSlug, '/account')} className={styles.smallBtn} style={{ marginTop: '14px' }}>
                Go to your account
              </Link>
            )}
          </div>
        )}

        {phase === 'pay' && clientSecret && (
          <StripePaymentForm
            clientSecret={clientSecret}
            stripeAccountId={stripeAccountId}
            submitLabel={`Pay ${price}`}
            onSuccess={pollForPass}
            onError={m => { setError(m); setPhase('error') }}
          />
        )}

        {phase === 'confirming' && <div className={styles.drawerStatus}>Confirming your payment…</div>}

        {phase === 'done' && (
          <div className={styles.resultWrap}>
            <div className={`${styles.resultCircle} ${styles.resultCircleSolid}`}>✓</div>
            <div className={styles.resultTitle}>Pass added to your account</div>
            <p className={styles.drawerText}>You can use it next time you book.</p>
            <button onClick={onPurchased} className={styles.blockBtn}>Done</button>
          </div>
        )}

        {phase === 'pending' && (
          <div className={styles.resultWrap}>
            <div className={`${styles.resultCircle} ${styles.resultCircleSolid}`}>✓</div>
            <div className={styles.resultTitle}>Payment received</div>
            <p className={styles.drawerText}>
              Your pass is still being added. It should appear in My passes in a few minutes. If it isn&apos;t there by then, contact the studio. Your payment is safe.
            </p>
            <Link href={studioPath(studioSlug, '/account')} className={styles.blockBtn} style={{ display: 'block', textAlign: 'center' }}>
              Go to My passes
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
