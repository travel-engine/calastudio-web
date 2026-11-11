'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Repeat } from 'lucide-react'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '@/app/components/Sidebar'
import Forbidden from '@/app/components/Forbidden'
import { canViewMembershipTemplates, canManageMembershipTemplates } from '@/lib/roles'
import { capLabel, coverageLabel, priceLabel, type MembershipTemplate } from '@/lib/memberships'
import { color, space, tabularNums } from '@/lib/ui/tokens'
import { Button, Card, Chip, EmptyState, PageHeader } from '@/app/components/admin'
import ui from '@/app/components/admin/admin.module.css'
import styles from '@/app/dashboard/dashboard.module.css'

// Dashboard → Memberships: the studio's membership plans (GET …/membership-templates). Members'
// memberships (staff list, cancel, comp) come with the API's staff-tools PR.

export default function MembershipsPage() {
  const router = useRouter()
  const [roles, setRoles] = useState<string[] | null>(null)
  const [templates, setTemplates] = useState<MembershipTemplate[] | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      const ctx = await getOrgContext()
      if (ctx.status === 'signed-out') { router.push('/login'); return }
      if (ctx.status === 'no-org') { router.push('/onboarding'); return }
      setRoles(ctx.roles)
      if (!canViewMembershipTemplates(ctx.roles)) return
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${ctx.org.id}/membership-templates`,
          { headers: { Authorization: `Bearer ${ctx.token}` } })
        if (res.status === 404) { setUnavailable(true); setTemplates([]); return }
        if (!res.ok) { setError('Could not load memberships.'); setTemplates([]); return }
        setTemplates(await res.json())
      } catch {
        setError('Could not reach the server. Please try again.')
        setTemplates([])
      }
    })()
  }, [router])

  const forbidden = roles != null && !canViewMembershipTemplates(roles)
  const canManage = roles != null && canManageMembershipTemplates(roles)

  return (
    <div className={styles.shell}>
      <Sidebar active="memberships" />
      <div className={styles.main}>
        {forbidden ? <Forbidden /> : (
        <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
          <PageHeader
            title="Memberships"
            actions={canManage && !unavailable ? <Button variant="primary" href="/dashboard/memberships/new" icon={<Plus size={18} aria-hidden />}>New membership</Button> : undefined}
          >
            Plans members pay for by the week or month, instead of buying credits.
          </PageHeader>

          {error && <div role="alert" style={{ padding: '12px 16px', background: color.dangerBg, color: color.dangerInk, borderRadius: 8 }}>{error}</div>}

          {templates == null ? (
            <div style={{ color: color.muted }}>Loading…</div>
          ) : unavailable ? (
            <EmptyState icon={<Repeat size={28} aria-hidden />} message="Memberships aren’t switched on for your studio yet." />
          ) : templates.length === 0 ? (
            <EmptyState
              icon={<Repeat size={28} aria-hidden />}
              message="No memberships yet. Create a plan like “Weekly Unlimited, $45 a week” and members can buy it on your site."
              action={canManage ? <Button variant="primary" href="/dashboard/memberships/new">New membership</Button> : undefined}
            />
          ) : (
            <Card style={{ overflow: 'hidden' }}>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {templates.map((t, i) => (
                  <li key={t.id} style={{ borderTop: i ? `1px solid ${color.divider}` : 'none' }}>
                    <Link href={canManage ? `/dashboard/memberships/${t.id}` : '#'} className={ui.focusable}
                      style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '16px 20px', color: 'inherit', textDecoration: 'none', pointerEvents: canManage ? 'auto' : 'none' }}>
                      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 16 }}>{t.name}</div>
                        <div style={{ fontSize: 14, color: color.muted, marginTop: 2 }}>
                          {coverageLabel(t.session_type_restriction)} · {capLabel(t.session_cap, t.period_type, t.period_rolling_value)}
                        </div>
                      </div>
                      <div style={{ fontWeight: 600, ...tabularNums }}>{priceLabel(t)}</div>
                      {t.active_member_count != null && (
                        <div style={{ fontSize: 14, color: color.ink2, minWidth: 90, ...tabularNums }}>
                          {t.active_member_count} member{t.active_member_count === 1 ? '' : 's'}
                        </div>
                      )}
                      <Chip tone={t.is_active ? 'primary' : 'neutral'}>{t.is_active ? 'On sale' : 'Hidden'}</Chip>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
        )}
      </div>
    </div>
  )
}
