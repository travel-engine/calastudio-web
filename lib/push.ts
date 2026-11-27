// Web Push for the studio site (spec 07 §7.10). The browser side only: support checks, the service
// worker, subscribing this device and handing the subscription to the API. Which notifications get
// sent, and when, is decided by the API.

export type PushPreferences = {
  studio_push_enabled: boolean
  devices: number
  waitlist: boolean
  reminders: boolean
  class_changes: boolean
  account: boolean
}

export type PushPrefKey = 'waitlist' | 'reminders' | 'class_changes' | 'account'

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  // iPadOS reports as Mac; touch points give it away.
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** Where this device stands, for choosing what to show. */
export type PushSupport =
  | 'supported'      // can subscribe here
  | 'install-first'  // iPhone/iPad in Safari: only the Home Screen app can get pushes
  | 'unsupported'    // old browser, in-app browser, etc.

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported'
  const capable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (isIos() && !isStandalone()) return 'install-first'
  return capable ? 'supported' : 'unsupported'
}

export function permission(): NotificationPermission {
  return typeof Notification === 'undefined' ? 'default' : Notification.permission
}

export async function registerWorker(studioSlug: string): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register(`/sw.js?slug=${encodeURIComponent(studioSlug)}`, { scope: '/' })
  await navigator.serviceWorker.ready
  return reg
}

/** This device's current subscription, if it has one (without prompting). */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration('/')
  return (await reg?.pushManager.getSubscription()) ?? null
}

/** The server's VAPID public key, or null when push isn't set up on this API (404). */
export async function fetchPublicKey(apiUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${apiUrl}/api/push/public-key`)
    if (!res.ok) return null
    const data: { public_key?: string } = await res.json()
    return data.public_key || null
  } catch { return null }
}

function base64UrlToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/** Asks for permission (must run from a tap) and subscribes this device. Null when declined. */
export async function subscribeDevice(studioSlug: string, publicKey: string): Promise<PushSubscription | null> {
  const result = await Notification.requestPermission()
  if (result !== 'granted') return null
  const reg = await registerWorker(studioSlug)
  const existing = await reg.pushManager.getSubscription()
  if (existing) return existing
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) })
}

/** The body the API expects for POST .../push-subscriptions. */
export function subscriptionBody(sub: PushSubscription) {
  const json = sub.toJSON()
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
    user_agent: navigator.userAgent,
  }
}

/**
 * Unsubscribe this device and tell the API. Used by "Turn off" and on sign-out, so the next person
 * signing in on a shared phone doesn't get the previous member's notifications.
 * `remove` posts the endpoint to .../push-subscriptions/remove.
 */
export async function unsubscribeDevice(remove?: (endpoint: string) => Promise<unknown>): Promise<void> {
  try {
    const sub = await currentSubscription()
    if (!sub) return
    if (remove) { try { await remove(sub.endpoint) } catch { /* best effort */ } }
    await sub.unsubscribe()
  } catch { /* nothing to undo */ }
}

// Sign-out needs the studio's organisation id to tell the API to forget this device, and the nav's
// sign-out button doesn't have it, so it's remembered when the device subscribes.
const orgKey = (slug: string) => `cs-push-org:${slug}`

export function rememberPushOrg(studioSlug: string, orgId: string) {
  try { localStorage.setItem(orgKey(studioSlug), orgId) } catch { /* ignore */ }
}

/**
 * Call BEFORE signing out (while the token still works): removes this device from the member's
 * subscriptions and unsubscribes it, so a shared phone stops getting their notifications.
 */
export async function forgetPushDevice(studioSlug: string, accessToken: string | null | undefined): Promise<void> {
  let orgId: string | null = null
  try { orgId = localStorage.getItem(orgKey(studioSlug)); localStorage.removeItem(orgKey(studioSlug)) } catch { /* ignore */ }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  await unsubscribeDevice(orgId && accessToken
    ? endpoint => fetch(`${apiUrl}/api/organisations/${orgId}/members/me/push-subscriptions/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ endpoint }),
      })
    : undefined)
}
