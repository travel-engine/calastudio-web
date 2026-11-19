'use client'

import { useEffect, useRef } from 'react'
import { useBookingFlow } from '@/lib/store/bookingFlow'

// The widget's side of the iframe ↔ host-page bridge (public/widget.js is the other side).
// Messages are `{ source: 'calastudio', type, ... }`, posted to the parent with target '*' — the
// host's origin isn't known in advance, so nothing private goes over this channel:
//   resize   { height }        content height, so an inline widget never scrolls inside itself
//   overlay  { open }          booking drawer opened/closed — host goes full-screen while open
//   close                      popup's close button / Escape
//   event    { name, detail }  re-dispatched on the host page as `calastudio:{name}` DOM events:
//                              booking_started, booking_completed, waitlist_joined
//
// Links leaving the widget (My account, "Powered by", email links) open in a new tab rather than
// navigating the iframe — the member stays on the studio's site.
export default function EmbedFrame({ popup, studioName, children }: {
  popup: boolean
  studioName: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.parent === window) return
    const post = (msg: Record<string, unknown>) => window.parent.postMessage({ source: 'calastudio', ...msg }, '*')
    const event = (name: string, detail: Record<string, unknown>) => post({ type: 'event', name, detail })

    // Content height. Measured on the wrapper, not documentElement, whose scrollHeight never drops
    // below the iframe's own height and so would only ever grow.
    const el = ref.current
    let lastHeight = 0
    const sendHeight = () => {
      const h = Math.ceil(el?.getBoundingClientRect().height ?? 0)
      if (h && h !== lastHeight) { lastHeight = h; post({ type: 'resize', height: h }) }
    }
    const ro = new ResizeObserver(sendHeight)
    if (el) ro.observe(el)
    sendHeight()

    // Booking drawer state → overlay + analytics events.
    let wasOpen = false
    let lastStep: string | null = null
    const unsub = useBookingFlow.subscribe(s => {
      const open = s.occurrence !== null
      if (open !== wasOpen) {
        wasOpen = open
        post({ type: 'overlay', open })
        if (open && s.occurrence) event('booking_started', occurrenceDetail(s.occurrence))
      }
      if (s.step !== lastStep) {
        lastStep = s.step
        if (s.occurrence && s.step === 'success') event('booking_completed', occurrenceDetail(s.occurrence))
        if (s.occurrence && s.step === 'waitlist-joined') event('waitlist_joined', occurrenceDetail(s.occurrence))
      }
    })

    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank') return
      const url = new URL(a.href, window.location.href)
      const inWidget = url.origin === window.location.origin && url.pathname.startsWith('/embed/')
      if (!inWidget) { a.target = '_blank'; a.rel = 'noopener' }
    }
    document.addEventListener('click', onClick, true)

    const onKey = (e: KeyboardEvent) => {
      // The drawer handles its own Escape; only close the popup when no drawer is open.
      if (popup && e.key === 'Escape' && useBookingFlow.getState().occurrence === null) post({ type: 'close' })
    }
    document.addEventListener('keydown', onKey)

    return () => {
      ro.disconnect()
      unsub()
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [popup])

  const close = () => window.parent.postMessage({ source: 'calastudio', type: 'close' }, '*')

  return (
    <div ref={ref}>
      {popup && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '12px 16px', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font-body)',
          borderBottom: '1px solid color-mix(in srgb, var(--ink) 12%, transparent)',
        }}>
          <strong style={{ fontSize: 16 }}>{studioName}</strong>
          <button type="button" onClick={close} aria-label="Close" style={{
            border: 0, background: 'transparent', color: 'inherit', fontSize: 20, lineHeight: 1, padding: 8, cursor: 'pointer',
          }}>✕</button>
        </div>
      )}
      {children}
    </div>
  )
}

function occurrenceDetail(o: { occurrence_id: string; session_name: string; starts_at: string }) {
  return { occurrence_id: o.occurrence_id, session_name: o.session_name, starts_at: o.starts_at }
}
