'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getOrgContext } from '@/lib/orgContext'
import Sidebar from '@/app/components/Sidebar'
import { canManageMembershipTemplates } from '@/lib/roles'
import { Breadcrumb, PageHeader } from '@/app/components/admin'
import { color, space } from '@/lib/ui/tokens'
import MembershipForm from '../MembershipForm'
import styles from '@/app/dashboard/dashboard.module.css'

export default function NewMembershipPage() {
  const router = useRouter()
  const [ctx, setCtx] = useState<{ orgId: string; token: string; currency: string } | null>(null)

  useEffect(() => {
    (async () => {
      const c = await getOrgContext()
      if (c.status === 'signed-out') { router.push('/login'); return }
      if (c.status === 'no-org') { router.push('/onboarding'); return }
      if (!canManageMembershipTemplates(c.roles)) { router.push('/dashboard/memberships'); return }
      setCtx({ orgId: c.org.id, token: c.token, currency: (c.org.currency ?? 'AUD').toUpperCase() })
    })()
  }, [router])

  return (
    <div className={styles.shell}>
      <Sidebar active="memberships" />
      <div className={styles.main}>
        <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: space.cardGap }}>
          <Breadcrumb items={[{ label: 'Memberships', href: '/dashboard/memberships' }, { label: 'New membership' }]} />
          <PageHeader title="New membership" />
          {ctx ? <MembershipForm orgId={ctx.orgId} token={ctx.token} currency={ctx.currency} template={null} />
            : <div style={{ color: color.muted }}>Loading…</div>}
        </div>
      </div>
    </div>
  )
}
