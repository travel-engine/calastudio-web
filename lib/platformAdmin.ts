'use client'

import { createClient } from '@/lib/supabase'
import { getOrgContext, PLATFORM_ADMIN } from '@/lib/orgContext'

// CalaStudio's own admins (Travel Engine staff) — `is_platform_admin`, separate from any studio role.
// They may belong to no studio at all, so identity comes from GET /api/me, which works without one.
// Until the API has /api/me, fall back to the flag that rides on a studio membership (orgContext).
// The API enforces every platform-admin endpoint itself; this only decides what to render.

const API = process.env.NEXT_PUBLIC_API_URL

export type PlatformIdentity =
  | { status: 'signed-out' }
  | { status: 'ok'; token: string; isPlatformAdmin: boolean; firstName: string | null; hasStudio: boolean }

export async function getPlatformIdentity(): Promise<PlatformIdentity> {
  const { data: { session } } = await createClient().auth.getSession()
  if (!session) return { status: 'signed-out' }
  const token = session.access_token

  const [meRes, ctx] = await Promise.all([
    fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
    getOrgContext().catch(() => ({ status: 'no-org' as const })),
  ])
  if (!meRes && ctx.status !== 'ok') throw new Error('unreachable')
  const hasStudio = ctx.status === 'ok'
  if (meRes?.ok) {
    const me = await meRes.json()
    return { status: 'ok', token, isPlatformAdmin: me.is_platform_admin === true, firstName: me.first_name ?? null, hasStudio }
  }
  return {
    status: 'ok', token, hasStudio,
    isPlatformAdmin: ctx.status === 'ok' && ctx.roles.includes(PLATFORM_ADMIN),
    firstName: ctx.status === 'ok' ? ctx.firstName : null,
  }
}

/** Fetch against a platform-admin endpoint; `null` body when the response isn't JSON. */
export async function adminFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API}/api/platform-admin${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${token}` },
  })
  const body = await res.json().catch(() => null)
  return { res, body }
}
