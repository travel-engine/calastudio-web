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

// Studio switcher: someone on staff at more than one studio picks which one the dashboard shows.
// The choice is per browser and per user; /mine?org_id= returns that studio only if they still
// hold a staff role there (404 otherwise, and the choice is dropped).
const choiceKey = (userId: string) => `calastudio-studio:${userId}`
function readChoice(userId: string): string | null {
  try { return localStorage.getItem(choiceKey(userId)) } catch { return null }
}
function writeChoice(userId: string, orgId: string | null) {
  try { if (orgId) localStorage.setItem(choiceKey(userId), orgId); else localStorage.removeItem(choiceKey(userId)) } catch { /* storage unavailable */ }
}

export interface MyStudio { id: string; name: string; slug: string; logo_url: string | null; roles: string[] }
let studiosCache: { userId: string; promise: Promise<MyStudio[]> } | null = null

/** Every studio where the signed-in person has a staff role (GET /api/me/studios); [] if unavailable. */
export async function getMyStudios(): Promise<MyStudio[]> {
  const { data: { session } } = await createClient().auth.getSession()
  if (!session) return []
  if (studiosCache?.userId !== session.user.id) {
    const promise = fetch(`${API}/api/me/studios`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(r => (r.ok ? r.json() : []))
      .then(d => (Array.isArray(d) ? d : []))
      .catch(() => [])
    studiosCache = { userId: session.user.id, promise }
  }
  return studiosCache.promise
}

/** Make this studio the one the dashboard opens (e.g. one just created in onboarding). */
export async function rememberStudio(orgId: string) {
  const { data: { session } } = await createClient().auth.getSession()
  if (session) writeChoice(session.user.id, orgId)
  clearOrgContext()
}

/** Show another studio: remember it, then reload the dashboard so nothing from this one lingers. */
export async function switchStudio(orgId: string) {
  await rememberStudio(orgId)
  window.location.assign('/dashboard')
}

async function fetchOrgAndRoles(token: string, userId: string): Promise<Loaded | null> {
  const headers = { Authorization: `Bearer ${token}` }
  const chosen = readChoice(userId)
  let orgRes = await fetch(`${API}/api/organisations/mine${chosen ? `?org_id=${encodeURIComponent(chosen)}` : ''}`, { headers })
  // 404: no staff role there any more; 400: a malformed id. Either way, drop it and use the default.
  if (!orgRes.ok && chosen && (orgRes.status === 404 || orgRes.status === 400)) {
    writeChoice(userId, null)
    orgRes = await fetch(`${API}/api/organisations/mine`, { headers })
  }
  if (!orgRes.ok) return null
  const org: MyOrg = await orgRes.json()
  // Use roles, the platform-admin flag and the first name off the org response when the API
  // includes all three; otherwise one more call (/my-role carries them, the first name feeding the
  // dashboard greeting). A CalaStudio platform admin (Travel Engine staff) is not a studio role: it
  // rides in `roles` as PLATFORM_ADMIN so the sidebar can gate its link; lib/roles' studio checks
  // never match it.
  if (Array.isArray(org.roles) && 'is_platform_admin' in org && org.first_name) {
    return { org, roles: withPlatformAdmin(org.roles, org.is_platform_admin), firstName: org.first_name }
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
    const promise = fetchOrgAndRoles(token, userId)
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
  studiosCache = null
}
