'use client'

import { createClient } from '@/lib/supabase'

const API = process.env.NEXT_PUBLIC_API_URL

// The signed-in staff member's studio and roles — what every dashboard page bootstraps from.
//
// Fetched once and cached in memory for the life of the tab: org/roles rarely change, and the
// sidebar navigates client-side (next/link), so a page switch only pays for its own data call.
// A full reload starts fresh. The access token is never cached — it's read from the Supabase
// session on every call, so token refreshes are picked up.
//
// Roles here only decide what the UI renders; the API enforces every permission itself.

// GET /api/organisations/mine — loosely typed like the rest of the dashboard's org reads;
// Settings uses most of these fields, other pages just `id` / `slug` / `currency`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MyOrg = { id: string; slug: string; currency?: string; timezone?: string | null } & Record<string, any>

export type OrgContext =
  | { status: 'ok'; token: string; org: MyOrg; roles: string[]; firstName: string | null }
  | { status: 'signed-out' } // → /login
  | { status: 'no-org' }     // → /onboarding

type Loaded = { org: MyOrg; roles: string[]; firstName: string | null }

/** Pseudo-role for CalaStudio's own platform admins — see fetchOrgAndRoles. */
export const PLATFORM_ADMIN = 'platform_admin'
const withPlatformAdmin = (roles: string[], isAdmin: unknown) =>
  isAdmin === true && !roles.includes(PLATFORM_ADMIN) ? [...roles, PLATFORM_ADMIN] : roles
let cached: ({ userId: string } & Loaded) | null = null
let inflight: { userId: string; promise: Promise<Loaded | null> } | null = null

async function fetchOrgAndRoles(token: string): Promise<Loaded | null> {
  const headers = { Authorization: `Bearer ${token}` }
  const orgRes = await fetch(`${API}/api/organisations/mine`, { headers })
  if (!orgRes.ok) return null
  const org: MyOrg = await orgRes.json()
  // Use roles off the org response if the API includes them (and the platform-admin flag with
  // them); otherwise one more call, which also carries the first name for the dashboard greeting.
  // A CalaStudio platform admin (Platinum Ray) is not a studio role: it rides in `roles` as
  // PLATFORM_ADMIN so the sidebar can gate its link; lib/roles' studio checks never match it.
  if (Array.isArray(org.roles) && 'is_platform_admin' in org) {
    return { org, roles: withPlatformAdmin(org.roles, org.is_platform_admin), firstName: org.first_name ?? null }
  }
  const roleRes = await fetch(`${API}/api/organisations/${org.id}/my-role`, { headers })
  const me = roleRes.ok ? await roleRes.json() : null
  const roles: string[] = Array.isArray(org.roles) ? org.roles : (me?.roles ?? [])
  return { org, roles: withPlatformAdmin(roles, me?.is_platform_admin), firstName: me?.first_name ?? org.first_name ?? null }
}

/**
 * Resolve the current session's studio + roles. `fresh: true` skips the cache (Settings, which
 * edits the org). Concurrent callers share one request.
 */
export async function getOrgContext(opts: { fresh?: boolean } = {}): Promise<OrgContext> {
  const { data: { session } } = await createClient().auth.getSession()
  if (!session) { clearOrgContext(); return { status: 'signed-out' } }
  const token = session.access_token
  const userId = session.user.id

  if (!opts.fresh && cached?.userId === userId) {
    return { status: 'ok', token, org: cached.org, roles: cached.roles, firstName: cached.firstName }
  }

  if (!inflight || inflight.userId !== userId || opts.fresh) {
    const promise = fetchOrgAndRoles(token)
    inflight = { userId, promise }
    promise.finally(() => { if (inflight?.promise === promise) inflight = null })
  }
  const result = await inflight.promise
  if (!result) return { status: 'no-org' }
  cached = { userId, ...result }
  return { status: 'ok', token, org: result.org, roles: result.roles, firstName: result.firstName }
}

/** Drop the cached org/roles — after saving Settings, and on sign-out. */
export function clearOrgContext() {
  cached = null
  inflight = null
}
