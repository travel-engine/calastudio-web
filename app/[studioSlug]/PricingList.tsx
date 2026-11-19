'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { formatDate } from '@/lib/dates'
import PassPurchaseModal from './PassPurchaseModal'
import MembershipPurchaseModal from './MembershipPurchaseModal'
import { capLabel, coverageLabel, membershipTerms, priceLabel, type MembershipTemplate } from '@/lib/memberships'
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

// Cards stay collapsed to name + price; what's included and the terms open underneath.
function CardDetails({ children }: { children: React.ReactNode }) {
  return (
    <details style={{ marginTop: '6px' }}>
      <summary className={styles.passListMuted} style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--ink)', minHeight: '32px', display: 'list-item' }}>
        Details
      </summary>
      {children}
    </details>
  )
}

export default function PricingList({
  studioSlug, templates, memberships = [], orgId, currency, brandColor, stripeAccountId, paymentsEnabled,
}: {
  studioSlug: string
  templates: PassTemplate[]
  memberships?: MembershipTemplate[]
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
  const [joining, setJoining] = useState<MembershipTemplate | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => setToken(session?.access_token ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setToken(session?.access_token ?? null))
    return () => subscription.unsubscribe()
  }, [])

  if (templates.length === 0 && memberships.length === 0) {
    return <div className={styles.emptyState}>This studio doesn&apos;t have any passes for sale right now.</div>
  }

  const canPay = paymentsEnabled && !!stripeAccountId

  // The buy button's states are the same for a pass and a membership.
  const action = (id: string, label: string, onBuy: () => void, doneText: string) =>
    justBought === id ? (
      <div style={{ fontSize: '15px', color: 'var(--ink)', fontWeight: 600 }}>
        ✓ {doneText} — <Link href={studioPath(studioSlug, '/account?tab=passes')} style={{ textDecoration: 'underline' }}>view in your account</Link>
      </div>
    ) : token === undefined ? (
      <button disabled className={styles.smallBtn}>…</button>
    ) : token === null ? (
      <Link href={studioPath(studioSlug, '/account')} className={styles.smallBtn}>Sign in to buy</Link>
    ) : !canPay ? (
      <div style={{ fontSize: '14px', color: 'var(--danger)' }}>This studio hasn&apos;t set up card payments yet.</div>
    ) : (
      <button onClick={onBuy} className={styles.smallBtn}>{label}</button>
    )

  const both = memberships.length > 0 && templates.length > 0

  return (
    <>
      {memberships.length > 0 && (
        <section style={{ marginBottom: both ? '40px' : 0 }}>
          {both && <h2 className={styles.passesH2}>Memberships</h2>}
          <div className={styles.passGridFull}>
            {memberships.map(m => {
              const cap = capLabel(m.session_cap, m.period_type, m.period_rolling_value)
              return (
                <div key={m.id} className={styles.passListCard}>
                  <div className={styles.passListName}>{m.name}</div>
                  <div className={styles.passListPrice}>{priceLabel(m, money)}</div>
                  <CardDetails>
                    <div className={styles.passListDetail}>{m.session_cap == null ? 'Unlimited sessions' : cap.replace(/^(\d+)/, '$1 sessions')}</div>
                    <div className={styles.passListMuted}>{coverageLabel(m.session_type_restriction)}</div>
                    <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0 }}>
                      {membershipTerms(m, money).map(line => <li key={line} className={styles.passListMuted}>{line}</li>)}
                    </ul>
                    {m.description && <p className={styles.passListDetail} style={{ marginTop: '10px', color: 'var(--text-body)' }}>{m.description}</p>}
                  </CardDetails>
                  <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                    {action(m.id, 'Join', () => setJoining(m), 'Joined')}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {both && <h2 className={styles.passesH2}>Class passes</h2>}
      {templates.length > 0 && <div className={styles.passGridFull}>
        {templates.map(t => {
          const expiry = expiryText(t)
          const restriction = restrictionText(t)
          const unlimited = t.pass_type === 'unlimited' || t.credit_count == null
          return (
            <div key={t.id} className={styles.passListCard}>
              <div className={styles.passListName}>{t.name}</div>
              <div className={styles.passListPrice}>{money(t.price, t.currency || currency)}</div>
              <CardDetails>
                <div className={styles.passListDetail}>
                  {unlimited ? 'Unlimited classes' : `${t.credit_count} class${t.credit_count === 1 ? '' : 'es'}`}
                </div>
                {expiry && <div className={styles.passListMuted}>{expiry}</div>}
                {restriction && <div className={styles.passListMuted}>{restriction}</div>}
                {t.description && <p className={styles.passListDetail} style={{ marginTop: '10px', color: 'var(--text-body)' }}>{t.description}</p>}
              </CardDetails>

              <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                {action(t.id, 'Buy this pass', () => setBuying(t), 'Added')}
              </div>
            </div>
          )
        })}
      </div>}

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

      {joining && token && stripeAccountId && (
        <MembershipPurchaseModal
          template={joining}
          orgId={orgId}
          token={token}
          studioSlug={studioSlug}
          stripeAccountId={stripeAccountId}
          onClose={() => setJoining(null)}
          onPurchased={() => { setJustBought(joining.id); setJoining(null) }}
        />
      )}
    </>
  )
}
