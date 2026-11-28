/* CalaStudio studio-site service worker: Web Push only.
 *
 * Deliberately no fetch handler and no caching: pages always come from the network, so a release
 * is never hidden behind a stale cache. It exists to receive pushes and open the right page when a
 * notification is tapped.
 *
 * Served from public/ at the root of each studio host ({slug}.calastudio.app/sw.js; proxy.ts
 * passes dotted paths through), so its scope is that studio's whole site. Locally (path-based,
 * localhost:3000/{slug}/...) one worker covers every studio, so links get the /{slug} prefix.
 *
 * Registered as /sw.js?slug={studioSlug}, so the worker knows its studio for local path-based URLs.
 * Payload (JSON, sent by the API): { title, body, url, tag?, icon? }
 * `url` is a path on the studio site, e.g. "/account?tab=home".
 */

const STUDIO_SLUG = new URL(self.location.href).searchParams.get('slug') || ''

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

function studioUrl(slug, path) {
  const p = path && path.startsWith('/') ? path : '/' + (path || '')
  const host = self.location.hostname
  // On a studio subdomain the site is at the root; anywhere else (localhost, apex) it's /{slug}/...
  const onSubdomain = slug && host.split('.')[0] === slug
  const base = !slug || onSubdomain ? '' : '/' + slug
  const url = new URL(base + p, self.location.origin)
  // Tells AppLaunchHome this launch came from a notification, so it doesn't redirect to Home.
  url.searchParams.set('from', 'notification')
  return url.href
}

self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data && event.data.text() } }

  const title = data.title || 'Studio update'
  // Optional buttons, e.g. [{ action: 'yes', title: "Yes, I'm coming", url: '/account?…' }]. Android shows up to
  // two; iPhone (and anything without action support) ignores them and a tap opens data.url as usual.
  const actions = Array.isArray(data.actions)
    ? data.actions.filter(a => a && a.action && a.title).slice(0, 2)
    : []
  const options = {
    body: data.body || '',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    icon: data.icon || undefined,
    data: {
      url: studioUrl(STUDIO_SLUG, data.url || '/account?tab=home'),
      actionUrls: Object.fromEntries(actions.filter(a => a.url).map(a => [a.action, studioUrl(STUDIO_SLUG, a.url)])),
    },
    ...(actions.length ? { actions: actions.map(a => ({ action: a.action, title: a.title })) } : {}),
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const d = event.notification.data || {}
  // A button tap opens that button's page; a tap on the notification itself opens the main one.
  const target = (event.action && d.actionUrls && d.actionUrls[event.action]) || d.url || self.location.origin
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // Reuse an open window of the site if there is one.
    for (const w of windows) {
      if (new URL(w.url).origin === self.location.origin && 'focus' in w) {
        await w.focus()
        if ('navigate' in w) { try { await w.navigate(target) } catch { /* cross-scope */ } }
        return
      }
    }
    await self.clients.openWindow(target)
  })())
})
