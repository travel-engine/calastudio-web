'use client'

import { useEffect, useRef, useState } from 'react'
import { Repeat } from 'lucide-react'
import { getOrgContext } from '@/lib/orgContext'
import { fetchDemoInfo, formatResetTime } from '@/lib/demo'
import { STUDIO_SUBDOMAINS, studioSlugFromHost } from '@/lib/seo'
import { DEMO_URL } from '@/lib/demoUrl'

// The bar across the top of the demo studio (spec 19 §19.4): says it's a shared demo that resets
// nightly, and links back to the persona picker. Shown on the studio site when the public studio
// info says is_demo, and on the dashboard when the signed-in studio is the demo.
//
// The demo is rebuilt as a new organisation each night, so a page left open past the reset would be
// talking to a studio that no longer exists: it reloads itself a few minutes after the reset.

const RELOAD_AFTER_RESET_MS = 5 * 60 * 1000

/** The persona picker: on the app host (demo.calastudio.app, where the visitor signed up) it's
 *  /demo; from the studio's own subdomain it's the demo address, where their access is saved. */
function pickerUrl(): string {
  if (!STUDIO_SUBDOMAINS || typeof window === 'undefined') return '/demo'
  return studioSlugFromHost(window.location.host) ? DEMO_URL : '/demo'
}

export default function DemoStrip({ variant }: { variant: 'studio' | 'dashboard' }) {
  const [resetAt, setResetAt] = useState<string | null>(null)
  // Worked out in the browser: the server can't see the host, and hydration keeps a server-rendered href.
  const [switchHref, setSwitchHref] = useState('/demo')
  useEffect(() => { setSwitchHref(pickerUrl()) }, [])
  const [show, setShow] = useState(variant === 'studio')
  const barRef = useRef<HTMLDivElement>(null)
  const [barHeight, setBarHeight] = useState(0)

  // On the dashboard the bar is pinned to the top, and the fixed sidebar / mobile top bar sit below
  // it via --demo-strip-h (sidebar.module.css). Its height changes when the text wraps on a phone.
  useEffect(() => {
    if (variant !== 'dashboard' || !show || !barRef.current) return
    const el = barRef.current
    const root = document.documentElement
    const apply = () => {
      const h = el.offsetHeight
      setBarHeight(h)
      root.style.setProperty('--demo-strip-h', `${h}px`)
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => { ro.disconnect(); root.style.removeProperty('--demo-strip-h') }
  }, [variant, show])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (variant === 'dashboard') {
        const ctx = await getOrgContext().catch(() => null)
        if (cancelled || ctx?.status !== 'ok' || ctx.org.is_demo !== true) return
        setShow(true)
      }
      const info = await fetchDemoInfo()
      if (!cancelled && info?.next_reset_at) setResetAt(info.next_reset_at)
    })()
    return () => { cancelled = true }
  }, [variant])

  // Reload after the nightly rebuild, including when a phone wakes a tab that slept through it.
  useEffect(() => {
    if (!show || !resetAt) return
    const due = new Date(resetAt).getTime() + RELOAD_AFTER_RESET_MS
    const reloadIfDue = () => { if (Date.now() >= due) window.location.reload() }
    const timer = window.setTimeout(reloadIfDue, Math.max(0, due - Date.now()))
    document.addEventListener('visibilitychange', reloadIfDue)
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', reloadIfDue) }
  }, [show, resetAt])

  if (!show) return null

  const pinned = variant === 'dashboard'
  return (
    <>
    {/* Keeps the page content below the pinned bar. */}
    {pinned && <div aria-hidden style={{ height: barHeight }} />}
    <div ref={barRef} role="note" style={{
      ...(pinned ? { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 70 } : { position: 'relative', zIndex: 60 }),
      background: '#17201C', color: '#F3F4F1', fontSize: 13, lineHeight: 1.4,
      padding: '7px 16px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '4px 14px',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    }}>
      <span>
        <strong style={{ fontWeight: 700 }}>Shared demo.</strong>{' '}
        Anyone can change things here. It resets every night{resetAt ? ` at ${formatResetTime(resetAt)} your time` : ''}.
      </span>
      <a href={switchHref} style={{ color: '#F3F4F1', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5, textUnderlineOffset: 3 }}>
        <Repeat size={14} aria-hidden /> Switch view
      </a>
    </div>
    </>
  )
}
