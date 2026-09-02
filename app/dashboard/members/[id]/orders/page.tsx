'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewMembers } from '@/lib/roles'
import { formatDate } from '@/lib/dates'
import styles from '@/app/dashboard/dashboard.module.css'

interface Order {
  id: string
  created_at: string
  product_name: string
  type: 'booking' | 'pass_purchase' | 'membership_purchase'
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded'
  amount: number
  currency: string
}

const orderTypeLabels: Record<string, string> = {
  booking: 'Session', pass_purchase: 'Pass', membership_purchase: 'Membership',
}

function Badge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    succeeded: { bg: '#e8f5ee', color: '#085041', label: 'Paid' },
    pending: { bg: '#fff3cd', color: '#7a4f00', label: 'Pending' },
    failed: { bg: '#fdecea', color: '#8b1a1a', label: 'Failed' },
    refunded: { bg: '#f4f4f4', color: '#666', label: 'Refunded' },
    partially_refunded: { bg: '#f4f4f4', color: '#666', label: 'Part. refunded' },
  }
  const s = map[status] ?? { bg: '#f4f4f4', color: '#666', label: status }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '99px',
      fontSize: '12px', fontWeight: 500, backgroundColor: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  )
}

const th: React.CSSProperties = { textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0 0 8px' }
const td: React.CSSProperties = { fontSize: '13px', color: '#444', padding: '11px 0', borderTop: '1px solid #f4f4f4' }

function fmtMoney(amount: number, currency: string) {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount) }
  catch { return `${currency} ${amount.toFixed(2)}` }
}

export default function MemberOrdersPage() {
  const router = useRouter()
  const memberId = useParams().id as string

  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [roles, setRoles] = useState<string[]>([])
  const [memberName, setMemberName] = useState('')
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const t = session.access_token

      const orgRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/mine`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (!orgRes.ok) { router.push('/onboarding'); return }
      const org = await orgRes.json()

      const roleRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}/my-role`, {
        headers: { Authorization: `Bearer ${t}` },
      })
      const myRoles: string[] = roleRes.ok ? (await roleRes.json()).roles : []
      setRoles(myRoles)
      if (!canViewMembers(myRoles)) { setForbidden(true); setLoading(false); return }

      const base = `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}`
      const h = { Authorization: `Bearer ${t}` }
      const [detailRes, ordersRes] = await Promise.all([
        fetch(`${base}/members/${memberId}`, { headers: h }),
        fetch(`${base}/members/${memberId}/payments`, { headers: h }),
      ])
      if (detailRes.ok) setMemberName((await detailRes.json()).full_name ?? '')
      if (ordersRes.ok) setOrders(await ordersRes.json())
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, memberId])

  if (loading) {
    return (
      <div className={styles.shell}>
        <Sidebar active="members" />
        <div className={styles.main} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#666' }}>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <Sidebar active="members" roles={roles} />
      <div className={styles.main} style={{ maxWidth: '760px' }}>
        {forbidden ? <Forbidden /> : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '6px' }}>
              <a href={`/dashboard/members/${memberId}`} style={{ color: '#666', textDecoration: 'none', fontSize: '20px', lineHeight: 1 }}>←</a>
              <h1 style={{ fontSize: '22px', fontWeight: 700 }}>Orders</h1>
            </div>
            {memberName && <p style={{ fontSize: '13px', color: '#666', marginBottom: '24px', marginLeft: '34px' }}>{memberName}</p>}

            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              {orders.length === 0 ? (
                <p style={{ fontSize: '13px', color: '#666' }}>No orders.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, width: '110px' }}>Date</th>
                      <th style={th}>Name</th>
                      <th style={{ ...th, width: '90px' }}>Type</th>
                      <th style={{ ...th, textAlign: 'right', width: '90px' }}>Amount</th>
                      <th style={{ ...th, width: '100px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(o => (
                      <tr
                        key={o.id}
                        onClick={() => router.push(`/dashboard/orders/${o.id}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={td}>{formatDate(o.created_at)}</td>
                        <td style={{ ...td, fontWeight: 600, color: '#085041' }}>{o.product_name}</td>
                        <td style={td}>{orderTypeLabels[o.type] ?? o.type}</td>
                        <td style={{ ...td, textAlign: 'right' }}>{fmtMoney(o.amount, o.currency)}</td>
                        <td style={td}><Badge status={o.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
