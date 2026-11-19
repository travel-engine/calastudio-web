'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

// Public studio pages are server-rendered once, and phones (and the installed studio app) bring a
// tab back from memory without reloading it — so a page opened yesterday could still list
// yesterday's classes, old spots-left counts, etc. This re-fetches the server-rendered page when
// the visitor comes back to it (tab switch, unlocking the phone, reopening the app, back/forward
// cache) and it's more than STALE_MS old, and also every REFRESH_MS while it stays on screen.
// router.refresh() keeps client state (open booking drawer, scroll position) intact.
const STALE_MS = 60_000
const REFRESH_MS = 5 * 60_000

export default function RefreshWhenStale() {
  const router = useRouter()
  const loadedAt = useRef(Date.now())

  useEffect(() => {
    const refresh = () => {
      loadedAt.current = Date.now()
      router.refresh()
    }
    const refreshIfStale = () => {
      if (document.visibilityState === 'visible' && Date.now() - loadedAt.current > STALE_MS) refresh()
    }
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) refreshIfStale()
    }

    document.addEventListener('visibilitychange', refreshIfStale)
    window.addEventListener('focus', refreshIfStale)
    window.addEventListener('pageshow', onPageShow)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, REFRESH_MS)

    return () => {
      document.removeEventListener('visibilitychange', refreshIfStale)
      window.removeEventListener('focus', refreshIfStale)
      window.removeEventListener('pageshow', onPageShow)
      window.clearInterval(timer)
    }
  }, [router])

  return null
}
