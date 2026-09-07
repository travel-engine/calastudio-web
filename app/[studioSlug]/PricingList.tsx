'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { formatDate } from '@/lib/dates'
import PassPurchaseModal from './PassPurchaseModal'

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

const money = (n: number, c: string) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n) }
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
    return (
      <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '48px', textAlign: 'center', color: '#666', fontSize: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        This studio doesn&apos;t have any passes for sale right now.
      </div>
    )
  }

  const canPay = paymentsEnabled && !!stripeAccountId
  const btn: React.CSSProperties = {
    display: 'inline-block', padding: '9px 18px', backgroundColor: brandColor, color: 'white',
    borderRadius: '8px', fontSize: '13px', fontWeight: 600, textDecoration: 'none', border: 'none', cursor: 'pointer',
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
        {templates.map(t => {
          const expiry = expiryText(t)
          const restriction = restrictionText(t)
          const unlimited = t.pass_type === 'unlimited' || t.credit_count == null
          return (
            <div key={t.id} style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 700, fontSize: '16px' }}>{t.name}</div>
              <div style={{ fontSize: '24px', fontWeight: 800, margin: '8px 0' }}>{money(t.price, t.currency || currency)}</div>
              <div style={{ fontSize: '13px', color: '#444' }}>
                {unlimited ? 'Unlimited classes' : `${t.credit_count} class${t.credit_count === 1 ? '' : 'es'}`}
              </div>
              {expiry && <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>{expiry}</div>}
              {restriction && <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>{restriction}</div>}
              {t.description && <p style={{ fontSize: '13px', color: '#666', marginTop: '10px', marginBottom: 0 }}>{t.description}</p>}

              <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                {justBought === t.id ? (
                  <div style={{ fontSize: '13px', color: '#085041', fontWeight: 600 }}>
                    ✓ Added — <Link href={`/${studioSlug}/account`} style={{ color: brandColor }}>view your passes</Link>
                  </div>
                ) : token === undefined ? (
                  <button disabled style={{ ...btn, backgroundColor: '#e2e2e2', color: '#999', cursor: 'default' }}>…</button>
                ) : token === null ? (
                  <Link href={`/${studioSlug}/account`} style={btn}>Sign in to buy</Link>
                ) : !canPay ? (
                  <div style={{ fontSize: '12px', color: '#8b1a1a' }}>This studio hasn&apos;t set up card payments yet.</div>
                ) : (
                  <button onClick={() => setBuying(t)} style={btn}>Buy this pass</button>
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
