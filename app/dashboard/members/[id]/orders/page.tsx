'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Receipt } from 'lucide-react'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewMembers } from '@/lib/roles'
import { displayName } from '@/lib/names'
import { formatShortDate } from '@/lib/dates'
import { formatMoney } from '@/lib/money'
import { color, space, tabularNums } from '@/lib/ui/tokens'
import { Breadcrumb, Card, Chip, EmptyState, PageHeader, smallCapsStyle, type ChipTone } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
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
  booking: 'Class', pass_purchase: 'Pass', membership_purchase: 'Membership',
}

const orderStatusChip: Record<string, { label: string; tone: ChipTone }> = {
  succeeded: { label: 'Paid', tone: 'primary' },
  pending: { label: 'Awaiting payment', tone: 'warn' },
  failed: { label: 'Failed', tone: 'danger' },
  refunded: { label: 'Refunded', tone: 'neutral' },
  partially_refunded: { label: 'Part refunded', tone: 'neutral' },
}

const th: React.CSSProperties = { ...smallCapsStyle, textAlign: 'left', padding: '12px 20px', borderBottom: `1px solid ${color.border}`, whiteSpace: 'nowrap' }

export default function MemberOrdersPage() {
  const router = useRouter()
  const memberId = useParams().id as string

  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [roles, setRoles] = useState<string[]>([])
  const [memberName, setMemberName] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [timeZone, setTimeZone] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const ctx = await getOrgContext()
      if (ctx.status === 'signed-out') { router.push('/login'); return }
      if (ctx.status === 'no-org') { router.push('/onboarding'); return }
      const t = ctx.token
      const org = ctx.org
      setTimeZone(org.timezone ?? null)
      const myRoles: string[] = ctx.roles
      setRoles(myRoles)
      if (!canViewMembers(myRoles)) { setForbidden(true); setLoading(false); return }

      const base = `${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${org.id}`
      const h = { Authorization: `Bearer ${t}` }
      const [detailRes, ordersRes] = await Promise.all([
        fetch(`${base}/members/${memberId}`, { headers: h }),
        fetch(`${base}/members/${memberId}/payments`, { headers: h }),
      ])
      if (detailRes.ok) setMemberName(displayName(await detailRes.json()))
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
          <div style={{ color: color.muted }}>Loading…</div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.shell}>
      <Sidebar active="members" roles={roles} />
      <div className={styles.main}>
        {forbidden ? <Forbidden /> : (
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
            <Breadcrumb items={[{ label: 'Members', href: '/dashboard/members' }, { label: memberName || 'Member', href: `/dashboard/members/${memberId}` }, { label: 'Orders' }]} />
            <PageHeader eyebrow={memberName || undefined} title="Orders" />

            {orders.length === 0 ? (
              <Card><EmptyState icon={<Receipt size={22} strokeWidth={1.8} />} message="No orders yet." /></Card>
            ) : (
              <Card style={{ overflow: 'hidden' }} aria-label="Orders">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse', fontSize: 15 }}>
                    <thead>
                      <tr>
                        <th scope="col" style={th}>Date</th>
                        <th scope="col" style={th}>Item</th>
                        <th scope="col" style={th}>Type</th>
                        <th scope="col" style={{ ...th, textAlign: 'right' }}>Amount</th>
                        <th scope="col" style={th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o, i) => {
                        const td: React.CSSProperties = { padding: '12px 20px', borderBottom: i < orders.length - 1 ? `1px solid ${color.divider}` : 'none', verticalAlign: 'middle' }
                        const st = orderStatusChip[o.status] ?? { label: o.status, tone: 'neutral' as ChipTone }
                        return (
                          <tr key={o.id}>
                            <td style={{ ...td, whiteSpace: 'nowrap', color: color.ink2, ...tabularNums }}>{formatShortDate(o.created_at, timeZone)}</td>
                            <td style={td}>
                              <Link href={`/dashboard/orders/${o.id}`} className={ui.focusable} style={{ color: color.ink, fontWeight: 600, textDecoration: 'none' }}>{o.product_name}</Link>
                            </td>
                            <td style={{ ...td, color: color.ink2 }}>{orderTypeLabels[o.type] ?? o.type}</td>
                            <td style={{ ...td, textAlign: 'right', ...tabularNums }}>{formatMoney(o.amount, o.currency)}</td>
                            <td style={td}><Chip tone={st.tone}>{st.label}</Chip></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
