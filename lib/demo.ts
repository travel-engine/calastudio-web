// The shared demo studio (spec 19-demo-studio.md §19.4). Prospects sign up on /demo, then look
// around as one of four ready-made people ("personas"). The API rebuilds the studio every night at
// 2am Brisbane time, as a NEW organisation each time, so its id is never cached here: everything
// resolves it by slug, and open pages reload after the reset (see DemoStrip).

import { studioUrl, STUDIO_SUBDOMAINS, studioOrigin } from '@/lib/seo'

const API = process.env.NEXT_PUBLIC_API_URL

export type DemoInfo = {
  enabled: boolean
  studio_slug: string
  studio_name: string
  next_reset_at: string // UTC
  last_rebuilt_at: string | null
}

export type PersonaKey = 'owner' | 'teacher' | 'basic_teacher' | 'member'
export type Persona = { key: PersonaKey; name: string; role: string; description: string }

/** What /demo keeps after sign-up, so a visitor can switch personas for 7 days without signing up again. */
export type DemoVisitor = {
  access_token: string
  expires_at: string
  studio_slug: string
  studio_name: string
  personas: Persona[]
  first_name: string
}

const VISITOR_KEY = 'cs-demo-visitor'

/** GET /api/demo; null when the demo isn't available on this API (404, network). */
export async function fetchDemoInfo(): Promise<DemoInfo | null> {
  try {
    const res = await fetch(`${API}/api/demo`, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

export function readVisitor(): DemoVisitor | null {
  try {
    const raw = localStorage.getItem(VISITOR_KEY)
    if (!raw) return null
    const v: DemoVisitor = JSON.parse(raw)
    if (!v.access_token || new Date(v.expires_at).getTime() <= Date.now()) {
      localStorage.removeItem(VISITOR_KEY)
      return null
    }
    return v
  } catch { return null }
}

export function saveVisitor(v: DemoVisitor) {
  try { localStorage.setItem(VISITOR_KEY, JSON.stringify(v)) } catch { /* private mode: they'll sign up again */ }
}

export function forgetVisitor() {
  try { localStorage.removeItem(VISITOR_KEY) } catch { /* ignore */ }
}

export type SignUpForm = {
  first_name: string; last_name: string; email: string; studio_name: string; marketing_consent: boolean
}

export type SignUpResult =
  | { ok: true; visitor: DemoVisitor }
  | { ok: false; fieldErrors?: Record<string, string>; message: string }

export async function signUpVisitor(form: SignUpForm): Promise<SignUpResult> {
  let res: Response
  try {
    res = await fetch(`${API}/api/demo/visitors`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
  } catch {
    return { ok: false, message: "We couldn't reach the demo. Check your connection and try again." }
  }
  if (res.status === 429) return { ok: false, message: 'Too many tries from here. Please wait a few minutes and try again.' }
  const data = await res.json().catch(() => null)
  if (res.status === 400) {
    return { ok: false, fieldErrors: data?.errors ?? {}, message: 'Please check the highlighted fields.' }
  }
  if (!res.ok || !data?.access_token) return { ok: false, message: "The demo isn't available right now. Please try again later." }
  const visitor: DemoVisitor = {
    access_token: data.access_token, expires_at: data.expires_at,
    studio_slug: data.studio_slug, studio_name: data.studio_name, personas: data.personas ?? [],
    first_name: form.first_name.trim(),
  }
  saveVisitor(visitor)
  return { ok: true, visitor }
}

export type PersonaSignInResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'expired' | 'not_ready' | 'error'; message: string }

/**
 * POST /api/demo/sign-in, then hand the one-time token to /auth/callback on the right host:
 * staff personas sign in on the app (dashboard), the member on the studio's own site, because the
 * sign-in cookie belongs to the host it's set on.
 */
export async function signInAsPersona(visitor: DemoVisitor, persona: PersonaKey): Promise<PersonaSignInResult> {
  let res: Response
  try {
    res = await fetch(`${API}/api/demo/sign-in`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: visitor.access_token, persona }),
    })
  } catch {
    return { ok: false, reason: 'error', message: "We couldn't reach the demo. Check your connection and try again." }
  }
  const data = await res.json().catch(() => null)
  if (res.status === 401) {
    forgetVisitor()
    return { ok: false, reason: 'expired', message: 'Your demo access has ended. Sign up again to keep exploring; it only takes a moment.' }
  }
  if (res.status === 503) {
    return { ok: false, reason: 'not_ready', message: 'The demo studio is being set up. Please try again in a few minutes.' }
  }
  if (!res.ok || !data?.token_hash) {
    return { ok: false, reason: 'error', message: "Couldn't open the demo. Please try again." }
  }

  const params = new URLSearchParams({ token_hash: data.token_hash, type: data.type ?? 'magiclink' })
  if (persona === 'member') {
    // The callback must run on the studio host so the member's cookie is set there.
    params.set('next', STUDIO_SUBDOMAINS ? '/account?tab=home' : `/${visitor.studio_slug}/account?tab=home`)
    const origin = STUDIO_SUBDOMAINS ? studioOrigin(visitor.studio_slug) : ''
    return { ok: true, url: `${origin}/auth/callback?${params}` }
  }
  params.set('next', '/dashboard')
  return { ok: true, url: `/auth/callback?${params}` }
}

/** "2:00 am" in the visitor's own time zone. */
export function formatResetTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
  } catch { return '2:00 am' }
}

/** The demo's public studio site, e.g. for "See the studio's booking site". */
export const demoStudioUrl = (slug: string, path = '/') => studioUrl(slug, path)

/** Member sign-up on the demo studio answers 409 {code:"demo_sign_up_closed"}. */
export const DEMO_SIGN_UP_CLOSED_MESSAGE =
  "This is a demo studio, so new members can't join it. To look around as a member, open Try the demo and choose Priya."

export const isDemoSignUpClosed = (status: number, data: { code?: string } | null | undefined) =>
  status === 409 && data?.code === 'demo_sign_up_closed'
