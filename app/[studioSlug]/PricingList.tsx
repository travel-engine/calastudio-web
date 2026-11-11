'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { formatDate } from '@/lib/dates'
import PassPurchaseModal from './PassPurchaseModal'
import styles from './photofirst.module.css'
import { studioPath } from '@/lib/seo'

export interface PassTemplate {
  id: string
  name: string
  description: string | null
  price: number
  currency: string
  pass_type: 'credit' | 'unlimited'
  credit_count: number | null
  expiry_type: 'fixed_date' | 'rolling_days' | 'rolling_months'
  expiry_rolling_value: number | null
  expiry_fixed_date: string | null
  session_type_restriction: string[] | null
  delivery_mode_restriction: string[] | null
}

// Pinned locale: this component is SSR'd then hydrated, so an undefined (runtime-default) locale
// formats differently on the Node server vs. the browser and trips a hydration mismatch.
const money = (n: number, c: string) => {
  try { return new Intl.NumberFormat('en-AU', { style: 'currency', currency: c }).format(n) }
  catch { return `${c} ${n.toFixed(2)}` }
}

function expiryText(t: PassTemplate): string | null {
  if (t.expiry_type === 'fixed_date') {
    return t.expiry_fixed_date ? `Valid until ${formatDate(t.expiry_fixed_date)}` : null
  }
  if (t.expiry_type === 'rolling_days' && t.expiry_rolling_value) {
    return `Valid ${t.expiry_rolling_value} days from purchase`
  }
  if (t.expiry_type === 'rolling_months' && t.expiry_rolling_value) {
    return `Valid ${t.expiry_rolling_value} month${t.expiry_rolling_value === 1 ? '' : 's'} from purchase`
  }
  return null
}

function restrictionText(t: PassTemplate): string | null {
  const parts = [
    ...(t.session_type_restriction ?? []),
    ...(t.delivery_mode_restriction ?? []).map(m => (m === 'online' ? 'Online' : 'In person')),
  ]
  return parts.length > 0 ? `Valid for: ${parts.join(', ')}` : null
}

export default function PricingList({
  studioSlug, templates, orgId, currency, brandColor, stripeAccountId, paymentsEnabled,
}: {
  studioSlug: string
  templates: PassTemplate[]
  orgId: string
  currency: string
  brandColor: string
  stripeAccountId: string | null
  paymentsEnabled: boolean
}) {
  // undefined = still resolving the Supabase session; null = signed out.
  const [token, setToken] = useState<string | null | undefined>(undefined)
  const [buying, setBuying] = useState<PassTemplate | null>(null)
  const [justBought, setJustBought] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => setToken(session?.access_token ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setToken(session?.access_token ?? null))
    return () => subscription.unsubscribe()
  }, [])

  if (templates.length === 0) {
    return <div className={styles.emptyState}>This studio doesn&apos;t have any passes for sale right now.</div>
  }

  const canPay = paymentsEnabled && !!stripeAccountId

  return (
    <>
      <div className={styles.passGridFull}>
        {templates.map(t => {
          const expiry = expiryText(t)
          const restriction = restrictionText(t)
          const unlimited = t.pass_type === 'unlimited' || t.credit_count == null
          return (
            <div key={t.id} className={styles.passListCard}>
              <div className={styles.passListName}>{t.name}</div>
              <div className={styles.passListPrice}>{money(t.price, t.currency || currency)}</div>
              <div className={styles.passListDetail}>
                {unlimited ? 'Unlimited classes' : `${t.credit_count} class${t.credit_count === 1 ? '' : 'es'}`}
              </div>
              {expiry && <div className={styles.passListMuted}>{expiry}</div>}
              {restriction && <div className={styles.passListMuted}>{restriction}</div>}
              {t.description && <p className={styles.passListDetail} style={{ marginTop: '10px', color: 'var(--text-body)' }}>{t.description}</p>}

              <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                {justBought === t.id ? (
                  <div style={{ fontSize: '15px', color: 'var(--ink)', fontWeight: 600 }}>
                    ✓ Added — <Link href={studioPath(studioSlug, '/account')} style={{ textDecoration: 'underline' }}>view your passes</Link>
                  </div>
                ) : token === undefined ? (
                  <button disabled className={styles.smallBtn}>…</button>
                ) : token === null ? (
                  <Link href={studioPath(studioSlug, '/account')} className={styles.smallBtn}>Sign in to buy</Link>
                ) : !canPay ? (
                  <div style={{ fontSize: '14px', color: 'var(--danger)' }}>This studio hasn&apos;t set up card payments yet.</div>
                ) : (
                  <button onClick={() => setBuying(t)} className={styles.smallBtn}>Buy this pass</button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {buying && token && stripeAccountId && (
        <PassPurchaseModal
          template={buying}
          orgId={orgId}
          token={token}
          studioSlug={studioSlug}
          stripeAccountId={stripeAccountId}
          currency={currency}
          brandColor={brandColor}
          onClose={() => setBuying(null)}
          onPurchased={() => { setJustBought(buying.id); setBuying(null) }}
        />
      )}
    </>
  )
}
