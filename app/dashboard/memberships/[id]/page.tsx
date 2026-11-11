'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '@/app/components/Sidebar'
import { canManageMembershipTemplates } from '@/lib/roles'
import { Breadcrumb, PageHeader, alertStyle } from '@/app/components/admin'
import { color, space } from '@/lib/ui/tokens'
import type { MembershipTemplate } from '@/lib/memberships'
import MembershipForm from '../MembershipForm'
import styles from '@/app/dashboard/dashboard.module.css'

export default function EditMembershipPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [ctx, setCtx] = useState<{ orgId: string; token: string; currency: string } | null>(null)
  const [template, setTemplate] = useState<MembershipTemplate | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      const c = await getOrgContext()
      if (c.status === 'signed-out') { router.push('/login'); return }
      if (c.status === 'no-org') { router.push('/onboarding'); return }
      if (!canManageMembershipTemplates(c.roles)) { router.push('/dashboard/memberships'); return }
      setCtx({ orgId: c.org.id, token: c.token, currency: (c.org.currency ?? 'AUD').toUpperCase() })
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/organisations/${c.org.id}/membership-templates/${id}`,
          { headers: { Authorization: `Bearer ${c.token}` } })
        if (!res.ok) { setError(res.status === 404 ? 'This membership doesn’t exist.' : 'Could not load this membership.'); return }
        setTemplate(await res.json())
      } catch {
        setError('Could not reach the server. Please try again.')
      }
    })()
  }, [router, id])

  return (
    <div className={styles.shell}>
      <Sidebar active="memberships" />
      <div className={styles.main}>
        <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
          <Breadcrumb items={[{ label: 'Memberships', href: '/dashboard/memberships' }, { label: template?.name ?? 'Membership' }]} />
          <PageHeader title={template?.name ?? 'Membership'} />
          {error ? <div role="alert" style={alertStyle()}>{error}</div>
            : ctx && template ? <MembershipForm orgId={ctx.orgId} token={ctx.token} currency={ctx.currency} template={template} />
            : <div style={{ color: color.muted }}>Loading…</div>}
        </div>
      </div>
    </div>
  )
}
