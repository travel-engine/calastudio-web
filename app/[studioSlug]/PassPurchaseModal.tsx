'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import StripePaymentForm from './StripePaymentForm'
import type { PassTemplate } from './PricingList'
import styles from './photofirst.module.css'

const money = (n: number, c: string) => {
  try { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: c }).format(n) }
  catch { return `${c} ${n.toFixed(2)}` }
}

type Phase = 'loading' | 'pay' | 'confirming' | 'done' | 'error'

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

  useEffect(() => {
    let cancelled = false
    const start = async () => {
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
        if (cancelled) return
        if (!res.ok) {
          setError(res.status === 404
            ? "You're not a member of this studio yet. Join from your account, then come back to buy a pass."
            : data?.error ?? 'Could not start the purchase. Please try again.')
          setPhase('error')
          return
        }
        setClientSecret(data.client_secret)
        setPhase('pay')
      } catch {
        if (!cancelled) { setError('Could not reach the server. Please try again.'); setPhase('error') }
      }
    }
    start()
    return () => { cancelled = true }
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
    setPhase('done') // charged and confirmed; issuance is just lagging
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
              <Link href={`/${studioSlug}/account`} className={styles.smallBtn} style={{ marginTop: '14px' }}>
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
            dark
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
      </div>
    </div>
  )
}
