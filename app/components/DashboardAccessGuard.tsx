'use client'

import { useEffect, useState } from 'react'
import { getOrgContext, PLATFORM_ADMIN } from '@/lib/orgContext'
import { isStaff } from '@/lib/roles'
import { studioUrl } from '@/lib/seo'

// Keeps member-only accounts out of the studio dashboard. GET /organisations/mine returns a studio
// for any membership, members included, so without this a member could open the dashboard shell
// (the API still refuses its data). Holds the page until the check passes; shares the request the
// page itself makes through getOrgContext, so it adds no extra call. Signed-out and no-studio cases
// are left to the pages, which already send those to /login and /onboarding.
export default function DashboardAccessGuard({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let active = true
    getOrgContext().then(ctx => {
      if (!active) return
      if (ctx.status !== 'ok' || isStaff(ctx.roles)) { setAllowed(true); return }
      // A CalaStudio platform admin with no staff role here belongs in /admin, not this studio.
      window.location.replace(ctx.roles.includes(PLATFORM_ADMIN) ? '/admin' : studioUrl(ctx.org.slug, '/account'))
    }).catch(() => { if (active) setAllowed(true) })
    return () => { active = false }
  }, [])

  return allowed ? <>{children}</> : null
}
